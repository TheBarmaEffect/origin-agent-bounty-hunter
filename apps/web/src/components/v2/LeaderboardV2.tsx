import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AgentId, AgentState } from '../../types';
import { AGENTS, AGENT_ORDER } from '../../lib/agents';
import { cn } from '../../lib/cn';

export type LeaderboardPhase = 'submission' | 'scoring' | 'reveal' | 'final';

export interface LeaderboardRow {
  agentId: AgentId;
  score: number;
  submissionRank: number;     // 1-5 by submit order
  finalRank: number;          // 1-5 by score
  status: AgentState['status'];
  isWinner: boolean;
}

interface Props {
  rows: LeaderboardRow[];
  phase: LeaderboardPhase;
  title?: string;
}

/**
 * The leaderboard inversion is the heart of the demo:
 *  - submission phase: bars in submit order, dim colors
 *  - scoring phase:    everything dims further (Optimus computing)
 *  - reveal phase:     bars animate from 0 to final score, in NEW order
 *  - final phase:      winner glows gold, others settled
 */
export function LeaderboardV2({ rows, phase, title = 'LIVE LEADERBOARD' }: Props) {
  // Sort rows by current display order
  const ordered = React.useMemo(() => {
    if (phase === 'submission' || phase === 'scoring') {
      return [...rows].sort((a, b) => a.submissionRank - b.submissionRank);
    }
    return [...rows].sort((a, b) => a.finalRank - b.finalRank);
  }, [rows, phase]);

  const dimAll = phase === 'scoring';

  return (
    <div className="glass-elev p-4 w-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
          <span className="text-[10px] font-extrabold tracking-[0.25em] text-white/80">{title}</span>
        </div>
        <PhaseIndicator phase={phase} />
      </div>

      <motion.div layout className="flex flex-col gap-2">
        <AnimatePresence mode="popLayout">
          {ordered.map((r) => (
            <LeaderRow key={r.agentId} row={r} phase={phase} dimAll={dimAll} />
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function PhaseIndicator({ phase }: { phase: LeaderboardPhase }) {
  const map: Record<LeaderboardPhase, { label: string; tone: string }> = {
    submission: { label: 'SUBMISSION ORDER', tone: 'text-white/40' },
    scoring:    { label: 'OPTIMUS SCORING…', tone: 'text-amber-300' },
    reveal:     { label: 'FINAL VERDICT',    tone: 'text-brand' },
    final:      { label: 'FINAL VERDICT',    tone: 'text-yellow-200' },
  };
  const v = map[phase];
  return (
    <span className={cn('text-[9px] font-bold tracking-widest font-mono', v.tone)}>
      {v.label}
    </span>
  );
}

interface RowProps {
  row: LeaderboardRow;
  phase: LeaderboardPhase;
  dimAll: boolean;
}

const LeaderRow = React.forwardRef<HTMLDivElement, RowProps>(function LeaderRow({ row, phase, dimAll }, ref) {
  const meta = AGENTS[row.agentId];
  const delta = row.submissionRank - row.finalRank; // +N if rank improved
  const showDelta = phase === 'reveal' || phase === 'final';
  const maxScore = 100;
  const targetWidth = phase === 'submission' ? 35 : (row.score / maxScore) * 100;

  return (
    <motion.div
      ref={ref}
      layout
      layoutId={`leader-${row.agentId}`}
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: dimAll ? 0.25 : 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      className="relative h-11 rounded-xl overflow-hidden flex items-center px-3 group"
      style={{
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* fill bar */}
      <motion.div
        key={`${phase}-${row.agentId}`}
        className="absolute inset-y-0 left-0 rounded-xl"
        initial={{ width: phase === 'reveal' ? 0 : `${targetWidth}%` }}
        animate={{ width: `${targetWidth}%` }}
        transition={
          phase === 'reveal'
            ? { type: 'spring', stiffness: 200, damping: 20 }
            : { type: 'tween', duration: 0.6, ease: 'easeOut' }
        }
        style={{
          background: row.isWinner
            ? 'linear-gradient(90deg, rgba(255,184,48,0.25), rgba(255,107,0,0.18))'
            : `linear-gradient(90deg, rgba(${meta.rgb},0.22), rgba(${meta.rgb},0.08))`,
          boxShadow: row.isWinner
            ? '0 0 20px rgba(255,184,48,0.35)'
            : `0 0 14px rgba(${meta.rgb},0.30)`,
        }}
      />

      {/* end-of-bar glowing dot */}
      <motion.span
        className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
        animate={{ left: `calc(${targetWidth}% - 4px)` }}
        transition={{ type: 'spring', stiffness: 200, damping: 22 }}
        style={{
          background: row.isWinner ? '#FFD700' : meta.color,
          boxShadow: `0 0 12px ${row.isWinner ? '#FFD700' : meta.color}`,
        }}
      />

      {/* content */}
      <div className="relative z-10 flex items-center justify-between w-full font-mono">
        <div className="flex items-center gap-2.5">
          <span
            className="text-[9px] font-extrabold tracking-widest px-1.5 py-0.5 rounded"
            style={{ color: meta.color, background: `rgba(${meta.rgb},0.14)`, border: `1px solid rgba(${meta.rgb},0.30)` }}
          >
            {meta.shortAlg}
          </span>
          <span className="text-[13px] font-extrabold tracking-tight text-white">{meta.name}</span>
        </div>

        <div className="flex items-center gap-3 text-[11px]">
          {showDelta && <DeltaBadge delta={delta} />}
          <ScoreNumber score={row.score} animateFrom={phase === 'reveal' ? 0 : undefined} winner={row.isWinner} />
        </div>
      </div>
    </motion.div>
  );
});

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) return <span className="text-[10px] text-white/30 font-mono">—</span>;
  const up = delta > 0;
  return (
    <motion.span
      initial={{ y: up ? 8 : -8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 16, delay: 0.3 }}
      className={cn(
        'text-[10px] font-extrabold tracking-wide tabular-nums px-1.5 py-0.5 rounded',
        up ? 'text-emerald-300 bg-emerald-500/10' : 'text-rose-300 bg-rose-500/10'
      )}
    >
      {up ? '↑' : '↓'}{Math.abs(delta)}
    </motion.span>
  );
}

function ScoreNumber({ score, animateFrom, winner }: { score: number; animateFrom?: number; winner?: boolean }) {
  // Count-up effect when reveal phase
  const [display, setDisplay] = React.useState(animateFrom ?? score);
  const startedRef = React.useRef(false);
  React.useEffect(() => {
    if (animateFrom === undefined) { setDisplay(score); return; }
    if (startedRef.current) return;
    startedRef.current = true;
    const start = performance.now();
    const dur = 1200;
    const tick = (t: number) => {
      const e = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - e, 3);
      setDisplay(animateFrom + (score - animateFrom) * eased);
      if (e < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [score, animateFrom]);

  return (
    <span className={cn('font-extrabold tabular-nums tracking-tight', winner ? 'text-yellow-200' : 'text-white')}>
      {display.toFixed(1)}
    </span>
  );
}
