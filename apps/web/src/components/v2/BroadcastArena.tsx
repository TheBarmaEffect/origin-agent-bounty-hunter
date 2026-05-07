import React from 'react';
import { motion } from 'framer-motion';
import type { AgentId, AgentState, BountyRace, BountyStatus } from '../../types';
import { useBountySSE } from '../../hooks/useBountySSE';
import { AGENT_ORDER, AGENTS } from '../../lib/agents';
import { BroadcastShell } from '../BroadcastShell';
import { BroadcastHeader } from './BroadcastHeader';
import { AgentCardV2 } from './AgentCardV2';
import { LeaderboardV2, LeaderboardPhase, LeaderboardRow } from './LeaderboardV2';
import { PaymentTickerV2, PaymentEvent, TickerStatus } from './PaymentTickerV2';
import { OptimusPanelV2, OptimusStatus } from './OptimusPanelV2';
import { VerdictRevealV2 } from './VerdictRevealV2';
import { IntroSplash } from './IntroSplash';
import { alarm, chime } from '../../lib/sound';

const ALGORITHMS = { scout: 'BFS', drill: 'DFS', compass: 'A*', dice: 'Monte Carlo', dash: 'Greedy' } as const;

function makeInitialRace(bountyId: string, title: string): BountyRace {
  const agents = {} as Record<AgentId, AgentState>;
  for (const id of AGENT_ORDER) {
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
    bountyId, title, budgetUsdc: 2,
    status: 'running', agents,
    payment: { stage: 'idle' }, proof: {}, strategyStats: [], elapsedMs: 0,
  };
}

interface Props {
  bountyId: string;
  bountyTitle: string;
  onComplete: (race: BountyRace) => void;
}

export function BroadcastArena({ bountyId, bountyTitle, onComplete }: Props) {
  const [race, setRace] = React.useState<BountyRace>(() => makeInitialRace(bountyId, bountyTitle));
  const [optimusStatus, setOptimusStatus] = React.useState<OptimusStatus>('classifying');
  const [leaderPhase, setLeaderPhase] = React.useState<LeaderboardPhase>('submission');
  const [payments, setPayments] = React.useState<PaymentEvent[]>([]);
  const [submissionOrderRef] = React.useState<{ counter: number; map: Map<AgentId, number> }>({ counter: 0, map: new Map() });
  const [showVerdictOverlay, setShowVerdictOverlay] = React.useState(false);
  const [showIntro, setShowIntro] = React.useState(true);
  const startTimeRef = React.useRef(Date.now());
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // Elapsed timer
  React.useEffect(() => {
    timerRef.current = setInterval(() => {
      setRace(r => ({ ...r, elapsedMs: Date.now() - startTimeRef.current }));
    }, 250);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // SSE handler — translate backend events to v2 component state
  const handleEvent = React.useCallback((event: any) => {
    const { type, payload } = event || {};
    if (!type) return;

    setRace(prev => {
      const next = { ...prev };

      switch (type) {
        case 'bounty.created':
          return { ...next, status: 'created', title: payload.title ?? next.title, budgetUsdc: payload.budgetUsdc ?? next.budgetUsdc };

        case 'optimus.classifying':
          setOptimusStatus('classifying');
          return next;

        case 'bounty.classified':
        case 'optimus.classified':
          setOptimusStatus('dispatching');
          return { ...next, classification: payload.classification ?? payload };

        case 'bounty.dispatched':
        case 'bounty.started':
          setOptimusStatus('monitoring');
          return { ...next, status: 'running' };

        case 'agent.queued':
        case 'agent.dispatched': {
          const id = payload.agentId as AgentId;
          return { ...next, agents: { ...next.agents, [id]: { ...next.agents[id], status: id ? 'queued' : 'queued' } } };
        }

        case 'agent.running': {
          const id = payload.agentId as AgentId;
          return { ...next, agents: { ...next.agents, [id]: { ...next.agents[id], status: 'running', progress: 0 } } };
        }

        case 'agent.progress': {
          const id = payload.agentId as AgentId;
          const agent = next.agents[id];
          const newLog = [...agent.progressLog, payload.message ?? ''].slice(-20);
          return { ...next, agents: { ...next.agents, [id]: { ...agent, progress: payload.progress ?? agent.progress, progressLog: newLog } } };
        }

        case 'agent.submitted': {
          const id = payload.agentId as AgentId;
          if (!submissionOrderRef.map.has(id)) {
            submissionOrderRef.counter += 1;
            submissionOrderRef.map.set(id, submissionOrderRef.counter);
          }
          return { ...next, agents: { ...next.agents, [id]: { ...next.agents[id], status: 'submitted', progress: 100, submittedAtMs: payload.elapsedMs ?? next.elapsedMs } } };
        }

        case 'agent.audit_check': {
          const id = payload.agentId as AgentId;
          const agent = next.agents[id];
          const checks = [...agent.auditChecks, { rule: payload.rule, passed: payload.passed, detail: payload.detail ?? '' }];
          return { ...next, agents: { ...next.agents, [id]: { ...agent, auditChecks: checks } } };
        }

        case 'agent.audit_passed': {
          const id = payload.agentId as AgentId;
          return { ...next, agents: { ...next.agents, [id]: { ...next.agents[id], status: 'scored' } } };
        }

        case 'agent.audit_failed': {
          const id = payload.agentId as AgentId;
          alarm();
          return { ...next, agents: { ...next.agents, [id]: { ...next.agents[id], status: 'audit_failed' } } };
        }

        case 'agent.scored': {
          const id = payload.agentId as AgentId;
          // Backend emits payload.scoreBreakdown; older callers used payload.score.
          const score = payload.scoreBreakdown ?? payload.score;
          return { ...next, agents: { ...next.agents, [id]: { ...next.agents[id], score, status: 'scored' } } };
        }

        case 'agent.disqualified': {
          const id = payload.agentId as AgentId;
          return { ...next, agents: { ...next.agents, [id]: { ...next.agents[id], status: 'disqualified', disqualified: true, disqualificationReason: payload.reason } } };
        }

        case 'optimus.judging':
        case 'bounty.judging':
          setOptimusStatus('evaluating');
          setLeaderPhase('scoring');
          // After 1.5s, transition to reveal
          setTimeout(() => setLeaderPhase('reveal'), 1500);
          return { ...next, status: 'judging' };

        case 'optimus.verdict':
        case 'bounty.verdict':
          setOptimusStatus('verdict');
          setLeaderPhase('final');
          setTimeout(() => setShowVerdictOverlay(true), 800);
          return {
            ...next, status: 'judging',
            winnerAgentId: payload.winnerAgentId,
            rationale: payload.rationale,
            predictionCorrect: payload.predictionCorrect,
            agents: {
              ...next.agents,
              ...(payload.winnerAgentId
                ? { [payload.winnerAgentId]: { ...next.agents[payload.winnerAgentId as AgentId], status: 'won' as const } }
                : {}),
              ...Object.fromEntries(
                Object.entries(next.agents)
                  .filter(([id]) => id !== payload.winnerAgentId && next.agents[id as AgentId].status !== 'disqualified')
                  .map(([id, agent]) => [id, { ...agent, status: 'lost' as const }])
              ),
            },
          };

        case 'payment.started': {
          const isHero = payload.purpose === 'bounty_fund' || payload.isHero;
          const id = isHero ? 'bounty-fund' : `payment-started-${payload.purpose ?? Date.now()}`;
          if (isHero) {
            appendPayment(setPayments, {
              id, agentId: 'user', endpoint: '/escrow/fund',
              amountUsdc: Number(payload.amount ?? next.budgetUsdc), status: 'verified',
              isHero: true, timestamp: Date.now(),
              txHash: payload.txHash,
            });
          }
          return { ...next, payment: { stage: 'started', demoMode: payload.demoMode } };
        }

        case 'payment.challenge':
          return { ...next, payment: { ...next.payment, stage: 'challenge', paymentId: payload.paymentId } };

        case 'payment.signed':
          appendPayment(setPayments, {
            id: `pay-${payload.paymentId ?? Date.now()}`, agentId: (payload.agentId as AgentId) || 'optimus',
            endpoint: '/winner/payout', amountUsdc: Number(payload.amount ?? next.budgetUsdc),
            status: 'signing', timestamp: Date.now(),
          });
          return next;

        case 'payment.settled':
          updatePayment(setPayments, `pay-${payload.paymentId ?? ''}`, { status: 'verified', txHash: payload.txHash });
          appendPayment(setPayments, {
            id: `payout-${Date.now()}`, agentId: (next.winnerAgentId as AgentId) || 'optimus',
            endpoint: '/winner/payout', amountUsdc: Number(payload.amount ?? next.budgetUsdc),
            status: 'verified', txHash: payload.txHash, timestamp: Date.now(),
          });
          return { ...next, status: 'paid', payment: { ...next.payment, stage: 'settled', txHash: payload.txHash, amount: payload.amount } };

        case 'payment.failed':
          return { ...next, payment: { ...next.payment, stage: 'failed' } };

        case 'proof.hash_created':
        case 'proof.created':
          return { ...next, proof: { ...next.proof, verdictHash: payload.verdictHash } };

        case 'proof.onchain_published':
        case 'proof.published':
          return { ...next, proof: { ...next.proof, onchainTxHash: payload.txHash, network: payload.network } };

        case 'bounty.completed':
        case 'bounty.paid': {
          if (timerRef.current) clearInterval(timerRef.current);
          // Don't auto-transition. Let user dismiss the verdict overlay via "CONTINUE →".
          return { ...next, status: 'paid' as const, elapsedMs: payload.elapsedMs ?? next.elapsedMs };
        }

        case 'bounty.failed':
          return { ...next, status: 'failed' };

        case 'strategy_memory.updated':
          return { ...next, strategyStats: payload.stats ?? next.strategyStats };

        case 'agent.x402_pay':
        case 'agent.payment': {
          // Per-agent x402 data fetch — dedupe by agentId so signing→verified
          // updates the same row in place rather than spawning a new one.
          if (payload.status === 'verified') chime();
          const id = payload.agentId as AgentId;
          const rowId = `agent-pay-${id}`;
          setPayments(prev => {
            const existing = prev.find(p => p.id === rowId);
            const updated: PaymentEvent = {
              id: rowId, agentId: id,
              endpoint: payload.endpoint ?? '/data/defi-protocols',
              amountUsdc: Number(payload.amount ?? 0.001),
              status: (payload.status as TickerStatus) ?? 'verified',
              txHash: payload.txHash ?? existing?.txHash,
              timestamp: existing?.timestamp ?? Date.now(),
            };
            if (existing) return prev.map(p => p.id === rowId ? updated : p);
            return [...prev, updated];
          });
          return next;
        }

        default:
          return next;
      }
    });
  }, [onComplete, submissionOrderRef]);

  useBountySSE(bountyId, handleEvent);

  // Build leaderboard rows
  const leaderRows: LeaderboardRow[] = AGENT_ORDER.map(id => {
    const a = race.agents[id];
    const sub = submissionOrderRef.map.get(id) ?? 99;
    return {
      agentId: id,
      score: a.score?.total ?? 0,
      submissionRank: sub,
      finalRank: 0, // computed below
      status: a.status,
      isWinner: a.status === 'won',
    };
  }).sort((a, b) => b.score - a.score)
    .map((r, i) => ({ ...r, finalRank: i + 1 }));

  const totalSpent = payments.reduce((sum, p) => p.status === 'verified' ? sum + p.amountUsdc : sum, 0);

  // Optimus prediction (if available)
  const prediction = race.classification ? {
    agentId: race.classification.expectedWinnerAgentId,
    confidence: race.classification.confidence ?? 0.65,
    problemType: race.classification.problemType ?? 'unknown',
    correct: race.predictionCorrect,
  } : undefined;

  // Optimus rows
  const optimusRows = AGENT_ORDER.map(id => {
    const a = race.agents[id];
    return {
      agentId: id,
      audits: a.auditChecks,
      score: a.score,
      violated: a.disqualified || a.status === 'audit_failed',
    };
  });

  // Strategy memory (use stats if present, else placeholder)
  const memory = race.strategyStats?.length ? race.strategyStats.map((s: any) => ({
    algo: AGENTS[s.agentId as AgentId]?.shortAlg ?? s.agentId,
    taskType: s.taskType ?? 'general',
    winRate: Math.round((s.winRate ?? 0) * 100),
    trend: s.trend ?? 'flat' as const,
    highlight: s.agentId === race.winnerAgentId,
  })) : DEFAULT_MEMORY;

  return (
    <BroadcastShell>
      <BroadcastHeader
        liveTitle={race.title}
        elapsedSec={race.elapsedMs / 1000}
        totalSpent={totalSpent}
        agentCount={AGENT_ORDER.length}
      />

      <main className="flex-1 grid grid-cols-12 gap-3 px-3 pb-3 pt-3 overflow-hidden">
        {/* CENTER ZONE — Arena */}
        <section className="col-span-12 lg:col-span-8 flex flex-col gap-3 overflow-hidden">
          {/* Agent cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            {AGENT_ORDER.map(id => {
              const a = race.agents[id];
              const sub = submissionOrderRef.map.get(id);
              const finalRow = leaderRows.find(r => r.agentId === id);
              const rank = leaderPhase === 'submission' || leaderPhase === 'scoring' ? sub : finalRow?.finalRank;
              const delta = sub && finalRow ? sub - finalRow.finalRank : 0;
              const isWinner = a.status === 'won';
              const isPredicted = prediction?.agentId === id && !race.predictionCorrect && !isWinner;
              return (
                <AgentCardV2
                  key={id}
                  state={a}
                  rank={rank}
                  rankDelta={leaderPhase === 'reveal' || leaderPhase === 'final' ? delta : 0}
                  isWinner={isWinner}
                  isPredicted={isPredicted}
                  spendUsdc={payments.filter(p => p.agentId === id && p.status === 'verified').reduce((s, p) => s + p.amountUsdc, 0)}
                  elapsedMs={a.submittedAtMs ?? (a.status === 'running' ? race.elapsedMs : undefined)}
                />
              );
            })}
          </div>

          {/* Leaderboard */}
          <LeaderboardV2 rows={leaderRows} phase={leaderPhase} />
        </section>

        {/* RIGHT ZONE — Optimus + Payment ticker */}
        <aside className="col-span-12 lg:col-span-4 flex flex-col gap-3 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-hidden">
            <OptimusPanelV2
              status={optimusStatus}
              prediction={prediction}
              rows={optimusRows}
              memory={memory}
            />
          </div>
          <PaymentTickerV2 events={payments} totalSpent={totalSpent} />
        </aside>
      </main>

      {/* INTRO SPLASH */}
      <IntroSplash open={showIntro} onDone={() => setShowIntro(false)} />

      {/* VERDICT REVEAL OVERLAY */}
      <VerdictRevealV2
        open={showVerdictOverlay}
        winnerAgentId={(race.winnerAgentId as AgentId) || 'compass'}
        winnerScore={race.winnerAgentId ? (race.agents[race.winnerAgentId as AgentId]?.score?.total ?? 0) : 0}
        predictionWasWrong={race.predictionCorrect === false}
        predictionLine={
          race.predictionCorrect === false && prediction
            ? `${AGENTS[(race.winnerAgentId as AgentId) || 'compass'].name}'s ${AGENTS[(race.winnerAgentId as AgentId) || 'compass'].algorithm} found what ${AGENTS[prediction.agentId].algorithm} missed`
            : undefined
        }
        verdictText={race.rationale || 'Optimus has selected the winning solution based on constraint compliance, evidence quality, and methodology fit.'}
        payoutUsdc={Number(race.payment?.amount ?? race.budgetUsdc)}
        verdictHash={race.proof.verdictHash || ''.padEnd(64, '0')}
        txHash={race.proof.onchainTxHash || race.payment?.txHash}
        onDismiss={() => { setShowVerdictOverlay(false); onComplete(race); }}
      />
    </BroadcastShell>
  );
}

const DEFAULT_MEMORY = [
  { algo: 'A*',  taskType: 'Heuristic',     winRate: 71, trend: 'up' as const },
  { algo: 'BFS', taskType: 'Breadth',       winRate: 63, trend: 'flat' as const },
  { algo: 'MC',  taskType: 'Sparse',        winRate: 45, trend: 'up' as const },
  { algo: 'GRD', taskType: 'Speed-critical',winRate: 58, trend: 'flat' as const },
  { algo: 'DFS', taskType: 'Depth',         winRate: 49, trend: 'flat' as const },
];

function appendPayment(setPayments: React.Dispatch<React.SetStateAction<PaymentEvent[]>>, evt: PaymentEvent) {
  setPayments(prev => {
    if (prev.find(p => p.id === evt.id)) return prev;
    return [...prev, evt];
  });
}

function updatePayment(setPayments: React.Dispatch<React.SetStateAction<PaymentEvent[]>>, id: string, patch: Partial<PaymentEvent>) {
  setPayments(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
}
