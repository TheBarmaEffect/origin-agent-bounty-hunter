import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AgentState, AgentId } from '../../types';
import { AGENTS } from '../../lib/agents';
import { cn } from '../../lib/cn';

interface Props {
  state: AgentState;
  rank?: number;            // 1-5 (display position by submission or score)
  rankDelta?: number;       // +N up, -N down, 0 same
  isWinner?: boolean;
  isPredicted?: boolean;    // Optimus predicted this agent
  spendUsdc?: number;
  elapsedMs?: number;
  onClick?: () => void;
}

const ALGORITHM_RULES: Record<AgentId, string> = {
  scout:   'BFS — must explore ≥3 distinct depth-1 nodes before any depth-2 node. Audit fails if breadth requirement violated.',
  drill:   'DFS — commits to one path until depth ≥3 before backtracking. Audit fails if max depth < 3 (LIFO stack required).',
  compass: 'A* — declares heuristic at t=0, hashes it (sha256). Heuristic must be immutable across the run.',
  dice:    'Monte Carlo — fixed seed logged, ≥10 samples required. Reports variance + confidence.',
  dash:    'Greedy — picks highest-score immediate option. NEVER revisits a node. Submits on first acceptable answer.',
};

const STATUS_MAP: Record<AgentState['status'], { label: string; tone: string }> = {
  queued:        { label: 'QUEUED',     tone: 'text-white/40 bg-white/5' },
  running:       { label: 'RUNNING',    tone: 'text-emerald-300 bg-emerald-500/15 border border-emerald-400/30' },
  submitted:     { label: 'SUBMITTED',  tone: 'text-amber-300 bg-amber-500/15 border border-amber-400/30' },
  audit_failed:  { label: 'VIOLATION',  tone: 'text-rose-300 bg-rose-500/20 border border-rose-400/40' },
  scored:        { label: 'SCORED',     tone: 'text-sky-300 bg-sky-500/15 border border-sky-400/30' },
  disqualified:  { label: 'PENALIZED',  tone: 'text-rose-300 bg-rose-500/20 border border-rose-400/40' },
  won:           { label: 'WINNER',     tone: 'text-yellow-200 bg-yellow-500/20 border border-yellow-400/50' },
  lost:          { label: 'COMPLETE',   tone: 'text-white/50 bg-white/5' },
};

function formatMs(ms?: number) {
  if (!ms || ms < 0) return '—';
  const s = ms / 1000;
  return `${s.toFixed(1)}s`;
}

export function AgentCardV2({ state, rank, rankDelta = 0, isWinner, isPredicted, spendUsdc = 0, elapsedMs, onClick }: Props) {
  const meta = AGENTS[state.agentId as AgentId];
  const status = STATUS_MAP[state.status];
  const violated = state.status === 'audit_failed' || state.status === 'disqualified' || state.disqualified;
  const tooltip = ALGORITHM_RULES[state.agentId as AgentId];

  const variants = {
    initial: { opacity: 0, y: 12, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    violated: { opacity: 1, y: 0, scale: 1, x: [0, -6, 6, -6, 6, -3, 3, 0], transition: { duration: 0.45 } },
    winner:   { opacity: 1, y: 0, scale: 1.03, transition: { type: 'spring' as const, stiffness: 220, damping: 18 } },
  };

  return (
    <motion.div
      layout
      layoutId={`agent-card-${state.agentId}`}
      initial="initial"
      animate={violated ? 'violated' : isWinner ? 'winner' : 'animate'}
      variants={variants}
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 240, damping: 22 }}
      onClick={onClick}
      title={tooltip}
      className={cn(
        'glass relative p-4 cursor-pointer select-none overflow-hidden',
        'transition-shadow duration-300',
        !violated && !isWinner && meta.glowClass,
        violated && 'glow-violation',
        isWinner && 'glow-winner',
      )}
      style={{
        // Subtle agent-tinted base
        background: violated
          ? 'rgba(255, 68, 85, 0.08)'
          : isWinner
            ? 'linear-gradient(180deg, rgba(255,184,48,0.10), rgba(255,184,48,0.02))'
            : `linear-gradient(180deg, rgba(${meta.rgb},0.05), rgba(255,255,255,0.02))`,
      }}
    >
      {/* winner specular shimmer overlay */}
      {isWinner && (
        <div className="pointer-events-none absolute inset-0 specular-shimmer rounded-[18px]" />
      )}

      {/* HEADER ROW: algo badge + rank */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-widest font-mono"
            style={{
              color: meta.color,
              background: `rgba(${meta.rgb},0.12)`,
              border: `1px solid rgba(${meta.rgb},0.35)`,
            }}
          >
            {meta.algorithm.toUpperCase()}
          </span>
          {isPredicted && (
            <span className="text-[9px] px-1.5 py-0.5 rounded text-brand bg-brand/10 border border-brand/30 font-bold tracking-wider">
              PREDICTED
            </span>
          )}
        </div>

        <RankBadge rank={rank} delta={rankDelta} winner={isWinner} violated={violated} />
      </div>

      {/* NAME */}
      <div className="flex items-baseline gap-2 mb-1">
        <h3 className="text-[22px] font-extrabold tracking-tight leading-none text-white">
          {meta.name}
        </h3>
      </div>
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/30 mb-3 font-medium">{meta.tagline}</p>

      <div className="h-px bg-white/5 mb-3" />

      {/* STATUS */}
      <div className="flex items-center justify-between mb-2.5">
        <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-bold tracking-widest', status.tone)}>
          {state.status === 'running' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse" />}
          {status.label}
        </span>
        <span className="text-[10px] text-white/40 font-mono tabular-nums">{formatMs(elapsedMs)}</span>
      </div>

      {/* PROGRESS BAR */}
      <ProgressBar value={state.progress} color={meta.color} rgb={meta.rgb} violated={violated} />

      <div className="h-px bg-white/5 my-3" />

      {/* FOOTER: spend + elapsed */}
      <div className="flex items-center justify-between text-[11px] font-mono">
        <span className="text-white/55">
          <span className="text-white/30 mr-1">$</span>
          <span className="tabular-nums">{spendUsdc.toFixed(3)}</span>
          <span className="text-white/30 ml-1">spent</span>
        </span>
        {state.score && (
          <span className="text-white/80 font-bold tabular-nums">
            {state.score.total.toFixed(1)}
            <span className="text-white/30 font-normal text-[9px] ml-1">SCORE</span>
          </span>
        )}
      </div>

      {/* AUDIT BADGES */}
      <AnimatePresence>
        {state.auditChecks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 flex gap-1 flex-wrap"
          >
            {state.auditChecks.map((c, i) => (
              <span
                key={i}
                title={c.detail}
                className={cn(
                  'text-[9px] px-1.5 py-0.5 rounded font-mono tracking-wide',
                  c.passed
                    ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-400/20'
                    : 'bg-rose-500/15 text-rose-300 border border-rose-400/30'
                )}
              >
                {c.passed ? '✓' : '✗'} {c.rule.slice(0, 14)}
              </span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* VIOLATION BANNER */}
      <AnimatePresence>
        {violated && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 px-2 py-1 rounded text-[10px] font-bold tracking-wider text-rose-300 bg-rose-500/15 border border-rose-400/30 flex items-center gap-1.5"
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
            CONSTRAINT VIOLATION
          </motion.div>
        )}
      </AnimatePresence>

      {/* WINNER BADGE */}
      <AnimatePresence>
        {isWinner && (
          <motion.div
            initial={{ y: -30, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 16 }}
            className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-extrabold tracking-[0.2em] text-yellow-100 bg-gradient-to-r from-yellow-500/40 via-amber-400/40 to-yellow-500/40 border border-yellow-300/50 shadow-lg"
          >
            ★ WINNER
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ProgressBar({ value, color, rgb, violated }: { value: number; color: string; rgb: string; violated: boolean }) {
  return (
    <div className="relative h-2 rounded-full overflow-hidden glass" style={{ background: 'rgba(255,255,255,0.04)' }}>
      <motion.div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{
          background: violated
            ? 'linear-gradient(90deg, #FF4455, #FF6B7D)'
            : `linear-gradient(90deg, ${color}, rgba(${rgb},0.6))`,
          boxShadow: `0 0 14px rgba(${violated ? '255,68,85' : rgb}, 0.6)`,
        }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, value)}%` }}
        transition={{ type: 'spring', stiffness: 80, damping: 20 }}
      />
    </div>
  );
}

function RankBadge({ rank, delta, winner, violated }: { rank?: number; delta: number; winner?: boolean; violated?: boolean }) {
  if (!rank) return <div className="w-12" />;

  const tone = winner
    ? 'text-yellow-200 bg-yellow-500/20 border-yellow-400/50'
    : violated
      ? 'text-rose-300 bg-rose-500/15 border-rose-400/40'
      : delta > 0
        ? 'text-emerald-300 bg-emerald-500/15 border-emerald-400/30'
        : delta < 0
          ? 'text-rose-300 bg-rose-500/15 border-rose-400/30'
          : 'text-white/70 bg-white/5 border-white/15';

  const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '';

  return (
    <motion.div
      key={rank}
      initial={{ y: delta > 0 ? 8 : delta < 0 ? -8 : 0, opacity: 0.4 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 18 }}
      className={cn(
        'px-2 py-0.5 rounded-md border text-[11px] font-extrabold tracking-wide tabular-nums flex items-center gap-1',
        tone,
      )}
    >
      <span>#{rank}</span>
      {!!arrow && (
        <span className="text-[10px] font-bold opacity-90">
          {arrow}{Math.abs(delta)}
        </span>
      )}
    </motion.div>
  );
}
