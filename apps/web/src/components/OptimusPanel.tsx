import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BountyRace, AgentId, BountyStatus } from '../types';
import { PaymentFlow } from './PaymentFlow';
import { ProofReceipt } from './ProofReceipt';

const AGENT_NAMES: Record<AgentId, string> = {
  scout: 'SCOUT',
  drill: 'DRILL',
  compass: 'COMPASS',
  dice: 'DICE',
  dash: 'DASH',
};

const PHASE_LABELS: Record<BountyStatus, string> = {
  idle: 'IDLE',
  created: 'INITIALIZING',
  running: 'RUNNING',
  judging: 'JUDGING',
  paid: 'COMPLETE',
  failed: 'FAILED',
};

const PHASE_COLORS: Record<BountyStatus, string> = {
  idle: '#64748b',
  created: '#6366f1',
  running: '#22d3ee',
  judging: '#f59e0b',
  paid: '#10b981',
  failed: '#ef4444',
};

interface Props {
  race: BountyRace;
}

export function OptimusPanel({ race }: Props) {
  const { classification, agents, payment, proof, status, winnerAgentId } = race;
  const agentList = Object.values(agents);

  const phaseColor = PHASE_COLORS[status];
  const phaseLabel = PHASE_LABELS[status];

  const winnerName = winnerAgentId ? AGENT_NAMES[winnerAgentId] : undefined;

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="p-4 rounded-xl border border-brand/30 bg-surface">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-brand animate-pulse" />
          <span className="text-xs font-black tracking-widest text-brand">OPTIMUS</span>
        </div>
        <div className="text-[9px] text-slate-500">Orchestrator · Auditor · Judge</div>
      </div>

      {/* Current phase */}
      <div className="p-3 rounded-xl border border-border bg-surface">
        <div className="text-[9px] text-slate-600 font-bold tracking-wider mb-2">PHASE</div>
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: phaseColor, boxShadow: `0 0 8px ${phaseColor}` }}
          />
          <span className="text-sm font-black tracking-widest" style={{ color: phaseColor }}>
            {phaseLabel}
          </span>
        </div>
      </div>

      {/* Classification */}
      <AnimatePresence>
        {classification && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-xl border border-accent/30 bg-surface"
          >
            <div className="text-[9px] text-slate-600 font-bold tracking-wider mb-2">CLASSIFICATION</div>

            <div className="px-2 py-1 rounded bg-accent/10 border border-accent/30 mb-2">
              <span className="text-[10px] font-bold text-accent">{classification.problemType}</span>
            </div>

            <div className="text-[9px] text-slate-400 mb-1">
              Expected winner:{' '}
              <span className="font-bold text-accent">
                {AGENT_NAMES[classification.expectedWinnerAgentId]}
              </span>{' '}
              <span className="text-slate-600">
                ({Math.round(classification.confidence * 100)}% conf.)
              </span>
            </div>

            <div className="text-[9px] text-slate-500 leading-relaxed">
              {classification.classificationReason}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Audit summary */}
      <div className="p-3 rounded-xl border border-border bg-surface flex-1">
        <div className="text-[9px] text-slate-600 font-bold tracking-wider mb-2">AUDIT STATUS</div>
        <div className="space-y-2">
          {agentList.map(agent => {
            const hasChecks = agent.auditChecks.length > 0;
            const allPass = agent.auditChecks.every(c => c.passed);
            const isDQ = agent.status === 'disqualified';
            const isWon = agent.status === 'won';

            return (
              <div key={agent.agentId} className="flex items-center gap-2">
                <span
                  className={`text-[10px] ${
                    isDQ ? 'text-lose' : isWon ? 'text-yellow-400' : hasChecks && allPass ? 'text-win' : hasChecks ? 'text-lose' : 'text-slate-700'
                  }`}
                >
                  {isDQ ? '✗' : isWon ? '★' : hasChecks && allPass ? '✓' : hasChecks ? '!' : '○'}
                </span>
                <span
                  className={`text-[9px] font-bold ${
                    isDQ ? 'text-lose/70 line-through' : isWon ? 'text-yellow-400' : 'text-slate-400'
                  }`}
                >
                  {AGENT_NAMES[agent.agentId]}
                </span>
                {hasChecks && (
                  <span className="text-[9px] text-slate-600 ml-auto">
                    {agent.auditChecks.filter(c => c.passed).length}/{agent.auditChecks.length}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Winner announcement */}
      <AnimatePresence>
        {winnerAgentId && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-3 rounded-xl border border-yellow-400/40 bg-yellow-900/10 text-center"
          >
            <div className="text-[9px] text-yellow-600 font-bold tracking-wider mb-1">VERDICT</div>
            <div className="text-lg font-black text-yellow-400">{winnerName}</div>
            <div className="text-[9px] text-yellow-600">wins the bounty</div>
            {race.predictionCorrect !== undefined && (
              <div className={`mt-1 text-[9px] font-bold ${race.predictionCorrect ? 'text-win' : 'text-lose'}`}>
                Prediction {race.predictionCorrect ? 'correct ✓' : 'incorrect ✗'}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payment flow */}
      <PaymentFlow payment={payment} winnerName={winnerName} />

      {/* Proof */}
      <ProofReceipt proof={proof} />
    </div>
  );
}
