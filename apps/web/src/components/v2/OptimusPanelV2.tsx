import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hexagon } from 'lucide-react';
import type { AgentId, AuditCheck, ScoreBreakdown } from '../../types';
import { AGENTS, AGENT_ORDER } from '../../lib/agents';
import { cn } from '../../lib/cn';

export type OptimusStatus = 'standby' | 'classifying' | 'dispatching' | 'monitoring' | 'evaluating' | 'verdict';

interface AgentRow {
  agentId: AgentId;
  audits: AuditCheck[];
  score?: ScoreBreakdown;
  violated?: boolean;
}

interface MemoryRow {
  algo: string;
  taskType: string;
  winRate: number;
  trend: 'up' | 'flat' | 'down' | 'up-up';
  highlight?: boolean;
}

interface Props {
  status: OptimusStatus;
  prediction?: { agentId: AgentId; confidence: number; problemType: string; correct?: boolean };
  rows: AgentRow[];
  memory: MemoryRow[];
}

const STATUS_TONE: Record<OptimusStatus, { label: string; color: string; bg: string }> = {
  standby:      { label: 'STANDBY',      color: '#9CA3AF', bg: 'rgba(156,163,175,0.10)' },
  classifying:  { label: 'CLASSIFYING',  color: '#FBBF24', bg: 'rgba(251,191,36,0.12)' },
  dispatching:  { label: 'DISPATCHING',  color: '#3B8BFF', bg: 'rgba(59,139,255,0.12)' },
  monitoring:   { label: 'MONITORING',   color: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
  evaluating:   { label: 'EVALUATING',   color: '#FF6B00', bg: 'rgba(255,107,0,0.16)' },
  verdict:      { label: 'VERDICT',      color: '#FFB830', bg: 'rgba(255,184,48,0.16)' },
};

export function OptimusPanelV2({ status, prediction, rows, memory }: Props) {
  const tone = STATUS_TONE[status];
  const isThinking = status === 'classifying' || status === 'evaluating';

  // Rotating "thoughts" — gives the impression Optimus is actively reasoning.
  const THOUGHTS = [
    'checking heuristic immutability…',
    'validating sample diversity…',
    'computing quality delta…',
    'weighting evidence vs novelty…',
    'auditing constraint compliance…',
    'cross-checking submission timestamps…',
    'normalizing per-dimension scores…',
    'projecting prediction confidence…',
  ];
  const [thoughtIdx, setThoughtIdx] = React.useState(0);
  React.useEffect(() => {
    if (!isThinking) return;
    const t = setInterval(() => setThoughtIdx(i => (i + 1) % THOUGHTS.length), 1500);
    return () => clearInterval(t);
  }, [isThinking]);

  return (
    <div className="glass-elev p-4 h-full flex flex-col gap-4 overflow-y-auto scrollbar-thin">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.div
            animate={isThinking ? { rotate: 360 } : { rotate: 0 }}
            transition={isThinking ? { duration: 8, repeat: Infinity, ease: 'linear' } : {}}
            className="w-9 h-9 relative flex items-center justify-center"
          >
            <Hexagon className="w-9 h-9 text-brand" strokeWidth={1.5} />
            <span
              className="absolute inset-0 rounded-full"
              style={{ boxShadow: `0 0 18px rgba(255,107,0,0.45)` }}
            />
          </motion.div>
          <div>
            <div className="text-[20px] font-extrabold tracking-tight text-brand leading-none">OPTIMUS</div>
            <div className="text-[9px] tracking-[0.25em] text-muted font-mono mt-0.5">SUPERIOR AGENT</div>
          </div>
        </div>

        <span
          className="text-[10px] font-extrabold tracking-widest px-2 py-1 rounded font-mono"
          style={{ color: tone.color, background: tone.bg, border: `1px solid ${tone.color}55` }}
        >
          {isThinking && <span className="inline-block w-1 h-1 rounded-full mr-1 animate-pulse" style={{ background: tone.color }} />}
          {tone.label}
        </span>
      </div>

      {/* Rotating Optimus thoughts during thinking phases */}
      <AnimatePresence mode="wait">
        {isThinking && (
          <motion.div
            key={thoughtIdx}
            initial={{ opacity: 0, y: -2 }}
            animate={{ opacity: 0.85, y: 0 }}
            exit={{ opacity: 0, y: 2 }}
            transition={{ duration: 0.35 }}
            className="text-[10px] font-mono text-brand/85 tracking-wide"
          >
            <span className="opacity-60">▸</span> {THOUGHTS[thoughtIdx]}
          </motion.div>
        )}
      </AnimatePresence>

      {/* PREDICTION CARD */}
      <AnimatePresence>
        {prediction && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl p-3 relative overflow-hidden"
            style={{
              background: prediction.correct === false
                ? 'linear-gradient(135deg, rgba(245,158,11,0.10), rgba(245,158,11,0.02))'
                : 'linear-gradient(135deg, rgba(255,107,0,0.10), rgba(255,107,0,0.02))',
              border: `1px solid ${prediction.correct === false ? 'rgba(245,158,11,0.4)' : 'rgba(255,107,0,0.4)'}`,
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-extrabold tracking-widest text-white/60">
                {prediction.correct === false ? '✗ INCORRECT PREDICTION' : 'PREDICTING WINNER'}
              </span>
              <span className="text-[9px] font-mono text-white/30 uppercase">{prediction.problemType.replace(/-/g, '_')}</span>
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-[18px] font-extrabold tracking-tight text-white">{AGENTS[prediction.agentId].name}</span>
              <span className="text-[10px] font-mono text-white/45">({AGENTS[prediction.agentId].algorithm})</span>
            </div>
            <div className="relative h-1.5 rounded-full overflow-hidden bg-white/5">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ background: prediction.correct === false ? '#F59E0B' : '#FF6B00' }}
                initial={{ width: 0 }}
                animate={{ width: `${prediction.confidence * 100}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-white/40 font-mono">CONFIDENCE</span>
              <span className="text-[10px] text-white/85 font-bold tabular-nums">{Math.round(prediction.confidence * 100)}%</span>
            </div>
            {prediction.correct === false && (
              <div className="mt-2 text-[10px] text-amber-300/90 font-mono">STRATEGY MEMORY UPDATED</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* AUDIT TABLE */}
      <Section title="ALGORITHM AUDIT">
        <div className="flex flex-col gap-1.5 font-mono">
          {AGENT_ORDER.map((aid) => {
            const row = rows.find(r => r.agentId === aid);
            const meta = AGENTS[aid];
            const checks = row?.audits ?? [];
            const violated = row?.violated || checks.some(c => !c.passed);
            return (
              <motion.div
                key={aid}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px]',
                  violated && 'bg-rose-500/10 border border-rose-400/20'
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.color, boxShadow: `0 0 6px ${meta.color}` }} />
                <span className="font-bold text-white/85 w-14">{meta.name}</span>
                <span className="text-[9px] tracking-widest font-bold w-8" style={{ color: meta.color }}>{meta.shortAlg}</span>
                <span className="ml-auto flex gap-0.5">
                  {checks.map((c, i) => (
                    <motion.span
                      key={i}
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.15 }}
                      className={cn(
                        'inline-block w-3 h-3 text-center text-[10px] font-bold rounded-sm',
                        c.passed
                          ? 'text-emerald-300 bg-emerald-500/15'
                          : 'text-rose-300 bg-rose-500/20'
                      )}
                    >
                      {c.passed ? '✓' : '✗'}
                    </motion.span>
                  ))}
                </span>
                {checks.length > 0 && (
                  <span className={cn('text-[9px] font-bold tracking-widest shrink-0', violated ? 'text-rose-300' : 'text-emerald-300')}>
                    {violated ? 'VIOLATION' : 'COMPLIANT'}
                  </span>
                )}
              </motion.div>
            );
          })}
        </div>
      </Section>

      {/* QUALITY SCORES */}
      <Section title="QUALITY SCORES">
        <div className="font-mono text-[10px]">
          <div className="grid grid-cols-[1fr_repeat(4,38px)_56px] gap-1 text-[9px] text-white/30 tracking-widest mb-1.5 px-1">
            <span></span>
            <span className="text-right">CORR</span>
            <span className="text-right">EVID</span>
            <span className="text-right">RSN</span>
            <span className="text-right">FIT</span>
            <span className="text-right">TOTAL</span>
          </div>
          {rows.filter(r => r.score).sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0)).map((r) => {
            const meta = AGENTS[r.agentId];
            const s = r.score!;
            return (
              <motion.div
                key={r.agentId}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid grid-cols-[1fr_repeat(4,38px)_56px] gap-1 px-1 py-1 items-center text-white/85"
              >
                <span className="font-extrabold tracking-tight" style={{ color: meta.color }}>{meta.name}</span>
                <CountUp value={s.answerQuality} className="text-right tabular-nums" />
                <CountUp value={s.evidenceQuality} className="text-right tabular-nums" />
                <CountUp value={s.reasoningClarity} className="text-right tabular-nums" />
                <CountUp value={s.methodologyFit} className="text-right tabular-nums" />
                <CountUp value={s.total} decimals={1} className="text-right font-extrabold tabular-nums text-white" />
              </motion.div>
            );
          })}
        </div>
      </Section>

      {/* STRATEGY MEMORY */}
      <Section title="STRATEGY MEMORY">
        <div className="font-mono">
          <div className="grid grid-cols-[34px_1fr_50px_36px] gap-2 text-[9px] text-white/30 tracking-widest mb-1 px-1">
            <span>ALG</span>
            <span>TASK TYPE</span>
            <span className="text-right">WIN%</span>
            <span className="text-center">TR</span>
          </div>
          {memory.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                'grid grid-cols-[34px_1fr_50px_36px] gap-2 px-1 py-1 items-center text-[10px] rounded',
                m.highlight && 'bg-brand/10 ring-1 ring-brand/30'
              )}
            >
              <span className="text-white/85 font-bold">{m.algo}</span>
              <span className="text-white/55 truncate">{m.taskType}</span>
              <span className="text-right text-white/85 tabular-nums font-bold">{m.winRate}%</span>
              <span className="text-center">
                {m.trend === 'up' && <span className="text-emerald-300">↑</span>}
                {m.trend === 'up-up' && <span className="text-emerald-300">↑↑</span>}
                {m.trend === 'flat' && <span className="text-white/30">→</span>}
                {m.trend === 'down' && <span className="text-rose-300">↓</span>}
              </span>
            </motion.div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[9px] font-extrabold tracking-[0.28em] text-white/40 mb-2 font-mono">{title}</div>
      {children}
    </div>
  );
}

function CountUp({ value, decimals = 0, className }: { value: number; decimals?: number; className?: string }) {
  const [v, setV] = React.useState(0);
  const startedRef = React.useRef(false);
  React.useEffect(() => {
    if (startedRef.current) { setV(value); return; }
    startedRef.current = true;
    const start = performance.now();
    const dur = 600;
    const tick = (t: number) => {
      const e = Math.min(1, (t - start) / dur);
      setV(value * (1 - Math.pow(1 - e, 3)));
      if (e < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value]);
  return <span className={className}>{v.toFixed(decimals)}</span>;
}
