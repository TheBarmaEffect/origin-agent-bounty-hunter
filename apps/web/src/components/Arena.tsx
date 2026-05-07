import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BountyRace, AgentId, AgentState, BountyStatus, PaymentState, ProofState, StrategyStats } from '../types';
import { useBountySSE } from '../hooks/useBountySSE';
import { AgentCard } from './AgentCard';
import { OptimusPanel } from './OptimusPanel';
import { Leaderboard } from './Leaderboard';
import { StrategyMemory } from './StrategyMemory';

const AGENT_IDS: AgentId[] = ['scout', 'drill', 'compass', 'dice', 'dash'];
const ALGORITHMS = { scout: 'BFS', drill: 'DFS', compass: 'A*', dice: 'Monte Carlo', dash: 'Greedy' } as const;

function makeInitialRace(bountyId: string, title: string): BountyRace {
  const agents = {} as Record<AgentId, AgentState>;
  for (const id of AGENT_IDS) {
    agents[id] = {
      agentId: id,
      algorithm: ALGORITHMS[id],
      status: 'queued',
      progress: 0,
      progressLog: [],
      auditChecks: [],
      disqualified: false,
    };
  }
  return {
    bountyId,
    title,
    budgetUsdc: 2,
    status: 'running',
    agents,
    payment: { stage: 'idle' },
    proof: {},
    strategyStats: [],
    elapsedMs: 0,
  };
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m > 0) return `${m}m ${sec}s`;
  return `${s}s`;
}

const STATUS_BADGE: Record<BountyStatus, { label: string; color: string }> = {
  idle: { label: 'IDLE', color: '#64748b' },
  created: { label: 'CREATED', color: '#6366f1' },
  running: { label: 'RUNNING', color: '#22d3ee' },
  judging: { label: 'JUDGING', color: '#f59e0b' },
  paid: { label: 'PAID', color: '#10b981' },
  failed: { label: 'FAILED', color: '#ef4444' },
};

interface Props {
  bountyId: string;
  bountyTitle: string;
  onComplete: (race: BountyRace) => void;
}

export function Arena({ bountyId, bountyTitle, onComplete }: Props) {
  const [race, setRace] = useState<BountyRace>(() => makeInitialRace(bountyId, bountyTitle));
  const startTimeRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Elapsed timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setRace(r => ({ ...r, elapsedMs: Date.now() - startTimeRef.current }));
    }, 250);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleEvent = useCallback((event: any) => {
    const { type, payload } = event;

    setRace(prev => {
      const next = { ...prev };

      switch (type) {
        case 'bounty.created':
          return { ...next, status: 'created', title: payload.title ?? next.title, budgetUsdc: payload.budgetUsdc ?? next.budgetUsdc };

        case 'bounty.classified':
          return { ...next, classification: payload.classification };

        case 'bounty.started':
          return { ...next, status: 'running' };

        case 'agent.dispatched': {
          const id = payload.agentId as AgentId;
          return {
            ...next,
            agents: {
              ...next.agents,
              [id]: { ...next.agents[id], status: 'running', progress: 0 },
            },
          };
        }

        case 'agent.progress': {
          const id = payload.agentId as AgentId;
          const agent = next.agents[id];
          const newLog = [...agent.progressLog, payload.message].slice(-20);
          return {
            ...next,
            agents: {
              ...next.agents,
              [id]: { ...agent, progress: payload.progress ?? agent.progress, progressLog: newLog },
            },
          };
        }

        case 'agent.submitted': {
          const id = payload.agentId as AgentId;
          return {
            ...next,
            agents: {
              ...next.agents,
              [id]: { ...next.agents[id], status: 'submitted', progress: 100, submittedAtMs: payload.elapsedMs },
            },
          };
        }

        case 'agent.audit_check': {
          const id = payload.agentId as AgentId;
          const agent = next.agents[id];
          const checks = [...agent.auditChecks, { rule: payload.rule, passed: payload.passed, detail: payload.detail }];
          return {
            ...next,
            agents: { ...next.agents, [id]: { ...agent, auditChecks: checks } },
          };
        }

        case 'agent.audit_passed': {
          const id = payload.agentId as AgentId;
          return {
            ...next,
            agents: { ...next.agents, [id]: { ...next.agents[id], status: 'scored' } },
          };
        }

        case 'agent.audit_failed': {
          const id = payload.agentId as AgentId;
          return {
            ...next,
            agents: { ...next.agents, [id]: { ...next.agents[id], status: 'audit_failed' } },
          };
        }

        case 'agent.scored': {
          const id = payload.agentId as AgentId;
          return {
            ...next,
            agents: { ...next.agents, [id]: { ...next.agents[id], score: payload.score, status: 'scored' } },
          };
        }

        case 'agent.disqualified': {
          const id = payload.agentId as AgentId;
          return {
            ...next,
            agents: {
              ...next.agents,
              [id]: {
                ...next.agents[id],
                status: 'disqualified',
                disqualified: true,
                disqualificationReason: payload.reason,
              },
            },
          };
        }

        case 'bounty.judging':
          return { ...next, status: 'judging' };

        case 'bounty.verdict':
          return {
            ...next,
            status: 'judging',
            winnerAgentId: payload.winnerAgentId,
            rationale: payload.rationale,
            predictionCorrect: payload.predictionCorrect,
            agents: {
              ...next.agents,
              ...(payload.winnerAgentId
                ? { [payload.winnerAgentId]: { ...next.agents[payload.winnerAgentId as AgentId], status: 'won' } }
                : {}),
              ...Object.fromEntries(
                Object.entries(next.agents)
                  .filter(([id]) => id !== payload.winnerAgentId && next.agents[id as AgentId].status !== 'disqualified')
                  .map(([id, agent]) => [id, { ...agent, status: 'lost' }])
              ),
            },
          };

        case 'payment.started':
          return { ...next, payment: { stage: 'started', demoMode: payload.demoMode } };

        case 'payment.challenge':
          return { ...next, payment: { ...next.payment, stage: 'challenge', paymentId: payload.paymentId } };

        case 'payment.settled':
          return {
            ...next,
            status: 'paid',
            payment: { ...next.payment, stage: 'settled', txHash: payload.txHash, amount: payload.amount },
          };

        case 'payment.failed':
          return { ...next, payment: { ...next.payment, stage: 'failed' } };

        case 'proof.created':
          return {
            ...next,
            proof: { verdictHash: payload.verdictHash, onchainTxHash: payload.txHash, network: payload.network },
          };

        case 'bounty.completed':
        case 'bounty.paid': {
          if (timerRef.current) clearInterval(timerRef.current);
          const finalRace = {
            ...next,
            status: 'paid' as const,
            elapsedMs: payload.elapsedMs ?? next.elapsedMs,
          };
          setTimeout(() => onComplete(finalRace), 2000);
          return finalRace;
        }

        case 'bounty.failed':
          return { ...next, status: 'failed' };

        case 'strategy_memory.updated':
          return { ...next, strategyStats: payload.stats ?? next.strategyStats };

        default:
          return next;
      }
    });
  }, [onComplete]);

  useBountySSE(bountyId, handleEvent);

  const badge = STATUS_BADGE[race.status];
  const agentList = AGENT_IDS.map(id => race.agents[id]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <div className="sticky top-0 z-10 border-b border-border bg-bg/95 backdrop-blur px-6 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-brand animate-pulse" />
          <span className="text-xs font-black tracking-widest text-brand">ORIGIN</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-slate-300 truncate">{race.title}</div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-slate-500 font-mono tabular-nums">{formatElapsed(race.elapsedMs)}</span>

          <span
            className="text-[10px] font-bold tracking-widest px-2 py-1 rounded"
            style={{ color: badge.color, backgroundColor: `${badge.color}20`, border: `1px solid ${badge.color}40` }}
          >
            {badge.label}
          </span>

          <span className="text-[10px] text-slate-600 font-mono">${race.budgetUsdc} USDC</span>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex-1 flex gap-0 overflow-hidden">
        {/* Optimus panel */}
        <div className="w-64 shrink-0 border-r border-border p-4 overflow-y-auto scrollbar-thin">
          <OptimusPanel race={race} />
        </div>

        {/* Agent grid */}
        <div className="flex-1 p-4 overflow-y-auto scrollbar-thin">
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 mb-4">
            {agentList.map((agent, idx) => (
              <AgentCard
                key={agent.agentId}
                agent={agent}
                index={idx}
                isWinner={agent.agentId === race.winnerAgentId}
              />
            ))}
          </div>

          <Leaderboard agents={race.agents} winnerId={race.winnerAgentId} />
          <StrategyMemory stats={race.strategyStats} />
        </div>
      </div>
    </div>
  );
}
