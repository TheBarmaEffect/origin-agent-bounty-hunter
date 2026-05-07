import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AgentState, AgentId, Algorithm } from '../types';
import { ScoreBar } from './ScoreBar';

const AGENT_META: Record<AgentId, { name: string; emoji: string }> = {
  scout: { name: 'SCOUT', emoji: '🔭' },
  drill: { name: 'DRILL', emoji: '🔩' },
  compass: { name: 'COMPASS', emoji: '🧭' },
  dice: { name: 'DICE', emoji: '🎲' },
  dash: { name: 'DASH', emoji: '💨' },
};

const STATUS_CONFIG = {
  queued: { label: 'QUEUED', color: '#64748b', bg: 'bg-slate-800', pulse: false },
  running: { label: 'RUNNING', color: '#22d3ee', bg: 'bg-cyan-900/30', pulse: true },
  submitted: { label: 'SUBMITTED', color: '#6366f1', bg: 'bg-indigo-900/30', pulse: false },
  audit_failed: { label: 'AUDIT FAIL', color: '#ef4444', bg: 'bg-red-900/20', pulse: false },
  scored: { label: 'SCORED', color: '#10b981', bg: 'bg-emerald-900/20', pulse: false },
  disqualified: { label: 'DISQUALIFIED', color: '#ef4444', bg: 'bg-red-900/20', pulse: false },
  won: { label: 'WINNER', color: '#fbbf24', bg: 'bg-yellow-900/20', pulse: true },
  lost: { label: 'LOST', color: '#475569', bg: 'bg-slate-900', pulse: false },
};

interface Props {
  agent: AgentState;
  index: number;
  isWinner: boolean;
}

export function AgentCard({ agent, index, isWinner }: Props) {
  const meta = AGENT_META[agent.agentId];
  const statusCfg = STATUS_CONFIG[agent.status];
  const isRunning = agent.status === 'running';
  const isDQ = agent.status === 'disqualified';
  const isLost = agent.status === 'lost';

  const recentLogs = agent.progressLog.slice(-3);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: isWinner ? 1.02 : 1,
        x: isDQ ? [0, -6, 6, -6, 6, 0] : 0,
      }}
      transition={{
        delay: index * 0.1,
        x: { duration: 0.4, repeat: isDQ ? 0 : 0 },
      }}
      className={`
        relative rounded-xl border p-4 flex flex-col gap-3 transition-all duration-300
        ${isWinner ? 'winner-card border-yellow-400/60' : isDQ ? 'border-lose/40' : 'border-border'}
        ${isLost ? 'opacity-50' : ''}
        ${statusCfg.bg}
      `}
      style={{
        background: isWinner
          ? 'linear-gradient(135deg, #12121a 0%, #1a1600 100%)'
          : isDQ
          ? 'linear-gradient(135deg, #12121a 0%, #1a0000 100%)'
          : '#12121a',
      }}
    >
      {/* Winner badge */}
      <AnimatePresence>
        {isWinner && (
          <motion.div
            initial={{ opacity: 0, scale: 0, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="absolute -top-3 left-1/2 -translate-x-1/2 z-10"
          >
            <span className="px-3 py-1 rounded-full bg-yellow-400 text-black text-xs font-black tracking-widest shadow-lg">
              WINNER
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{meta.emoji}</span>
          <div>
            <div className={`font-black text-sm tracking-widest ${isWinner ? 'text-yellow-300' : isDQ ? 'text-slate-500 line-through' : 'text-slate-100'}`}>
              {meta.name}
            </div>
            <div className="text-[9px] text-slate-500 tracking-wider">{agent.algorithm}</div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {statusCfg.pulse && (
            <div
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: statusCfg.color }}
            />
          )}
          <span
            className="text-[9px] font-bold tracking-widest px-2 py-1 rounded-md"
            style={{
              color: statusCfg.color,
              backgroundColor: `${statusCfg.color}20`,
              border: `1px solid ${statusCfg.color}40`,
            }}
          >
            {statusCfg.label}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      {(isRunning || agent.status === 'submitted' || agent.progress > 0) && (
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-slate-500">Progress</span>
            <span className="text-[9px] text-slate-400 tabular-nums">{agent.progress}%</span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${agent.progress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              style={{
                background: isWinner
                  ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                  : isRunning
                  ? 'linear-gradient(90deg, #6366f1, #22d3ee)'
                  : '#10b981',
              }}
            />
          </div>
        </div>
      )}

      {/* Progress log */}
      {recentLogs.length > 0 && (
        <div className="space-y-0.5">
          {recentLogs.map((log, i) => (
            <motion.div
              key={`${i}-${log}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: i === recentLogs.length - 1 ? 1 : 0.4, x: 0 }}
              className="text-[9px] font-mono text-slate-400 truncate flex items-center gap-1"
            >
              <span className="text-slate-600">›</span>
              {log}
            </motion.div>
          ))}
        </div>
      )}

      {/* Audit checks */}
      {agent.auditChecks.length > 0 && (
        <div className="space-y-1">
          <div className="text-[9px] text-slate-500 tracking-wider font-bold">AUDIT</div>
          <div className="grid grid-cols-2 gap-1">
            {agent.auditChecks.map((check, i) => (
              <motion.div
                key={check.rule}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.08 }}
                className="flex items-center gap-1"
                title={check.detail}
              >
                <span className={`text-[10px] ${check.passed ? 'text-win' : 'text-lose'}`}>
                  {check.passed ? '✓' : '✗'}
                </span>
                <span className={`text-[9px] truncate ${check.passed ? 'text-slate-400' : 'text-lose/70'}`}>
                  {check.rule}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Score breakdown */}
      {agent.score && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="pt-2 border-t border-slate-800"
        >
          <div className="text-[9px] text-slate-500 tracking-wider font-bold mb-2">SCORE</div>
          <ScoreBar score={agent.score} compact />
        </motion.div>
      )}

      {/* DQ reason */}
      {isDQ && agent.disqualificationReason && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-2 rounded bg-lose/10 border border-lose/20"
        >
          <div className="text-[9px] text-lose font-bold mb-0.5">DISQUALIFIED</div>
          <div className="text-[9px] text-slate-400">{agent.disqualificationReason}</div>
        </motion.div>
      )}

      {/* Submission timing */}
      {agent.submittedAtMs !== undefined && (
        <div className="text-[9px] text-slate-600 text-right">
          Submitted in {(agent.submittedAtMs / 1000).toFixed(1)}s
        </div>
      )}
    </motion.div>
  );
}
