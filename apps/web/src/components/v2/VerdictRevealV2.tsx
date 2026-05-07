import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { ExternalLink } from 'lucide-react';
import type { AgentId } from '../../types';
import { AGENTS } from '../../lib/agents';
import { victory } from '../../lib/sound';

interface Props {
  open: boolean;
  winnerAgentId: AgentId;
  winnerScore: number;
  predictionWasWrong?: boolean;
  predictionLine?: string;             // e.g. "Monte Carlo's probabilistic search found what A* missed"
  verdictText: string;                 // 1-3 sentence summary, typewriter target
  payoutUsdc: number;
  verdictHash: string;                 // sha256 hex
  txHash?: string;                     // base sepolia tx
  onDismiss?: () => void;
}

/**
 * The 10-second climax sequence. Times in ms (relative):
 *   0    overlay fades in
 *   500  "OPTIMUS HAS REACHED A VERDICT" slides down
 *   1500 "ORIGIN VERDICT" 56px fades + scales in
 *   2000 (if wrong) "✗ OPTIMUS WAS WRONG" + typewriter sub-line
 *   2500 verdict text typewriter (40ms/char)
 *   ~6000 winner gold flash + confetti burst
 *   ~7000 payout count-up
 *   ~8000 receipt bar slides in
 */
export function VerdictRevealV2({
  open, winnerAgentId, winnerScore, predictionWasWrong, predictionLine,
  verdictText, payoutUsdc, verdictHash, txHash, onDismiss,
}: Props) {
  const meta = AGENTS[winnerAgentId];
  const [phase, setPhase] = React.useState(0);
  const [typed, setTyped] = React.useState('');
  const [predictionTyped, setPredictionTyped] = React.useState('');

  React.useEffect(() => {
    if (!open) { setPhase(0); setTyped(''); setPredictionTyped(''); return; }
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setPhase(1), 500));    // header
    timers.push(setTimeout(() => setPhase(2), 1500));   // ORIGIN VERDICT
    timers.push(setTimeout(() => setPhase(3), 2000));   // wrong-pred line + sub
    timers.push(setTimeout(() => setPhase(4), 2500));   // verdict text typewriter
    timers.push(setTimeout(() => setPhase(5), Math.max(6000, 2500 + verdictText.length * 40)));   // winner flash + confetti
    timers.push(setTimeout(() => setPhase(6), Math.max(7000, 2500 + verdictText.length * 40 + 800)));  // payout
    timers.push(setTimeout(() => setPhase(7), Math.max(8000, 2500 + verdictText.length * 40 + 1500))); // receipt bar
    return () => timers.forEach(clearTimeout);
  }, [open, verdictText.length]);

  // Verdict typewriter
  React.useEffect(() => {
    if (phase < 4) return;
    let i = 0;
    const tick = () => {
      i++;
      setTyped(verdictText.slice(0, i));
      if (i < verdictText.length) setTimeout(tick, 40);
    };
    setTimeout(tick, 0);
  }, [phase, verdictText]);

  // Prediction-wrong typewriter
  React.useEffect(() => {
    if (phase < 3 || !predictionWasWrong || !predictionLine) return;
    let i = 0;
    const tick = () => {
      i++;
      setPredictionTyped(predictionLine.slice(0, i));
      if (i < predictionLine.length) setTimeout(tick, 30);
    };
    setTimeout(tick, 0);
  }, [phase, predictionWasWrong, predictionLine]);

  // Confetti + victory fanfare at phase 5
  React.useEffect(() => {
    if (phase !== 5) return;
    victory();
    confetti({
      origin: { y: 0.3 },
      particleCount: 150,
      spread: 100,
      colors: ['#FFB830', '#FF6B00', '#FFD700'],
      ticks: 220,
    });
    const t = setTimeout(() => {
      confetti({ origin: { y: 0.4, x: 0.2 }, particleCount: 70, spread: 80, colors: ['#FFB830', '#FFD700'], ticks: 200 });
      confetti({ origin: { y: 0.4, x: 0.8 }, particleCount: 70, spread: 80, colors: ['#FF6B00', '#FFB830'], ticks: 200 });
    }, 300);
    return () => clearTimeout(t);
  }, [phase]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6"
          style={{
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
          }}
        >
          {/* gold flash on phase 5 */}
          <AnimatePresence>
            {phase >= 5 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.55, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.9, times: [0, 0.4, 1] }}
                className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(255,184,48,0.45), transparent 60%)' }}
              />
            )}
          </AnimatePresence>

          {/* Header banner */}
          <AnimatePresence>
            {phase >= 1 && (
              <motion.div
                initial={{ y: -30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[14px] tracking-[0.4em] font-extrabold text-white/65 mb-6 font-mono"
              >
                OPTIMUS HAS REACHED A VERDICT
              </motion.div>
            )}
          </AnimatePresence>

          {/* ORIGIN VERDICT */}
          <AnimatePresence>
            {phase >= 2 && (
              <motion.h1
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="text-[56px] md:text-[72px] font-black tracking-tight text-brand mb-6"
                style={{ letterSpacing: '-0.03em' }}
              >
                ORIGIN VERDICT
              </motion.h1>
            )}
          </AnimatePresence>

          {/* prediction-wrong line */}
          <AnimatePresence>
            {phase >= 3 && predictionWasWrong && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mb-3 text-center"
              >
                <div className="text-[20px] font-extrabold text-amber-300 tracking-tight">✗ OPTIMUS WAS WRONG</div>
                <div className="text-[14px] text-white/55 mt-1 font-mono min-h-[1.4em]">
                  {predictionTyped}
                  {predictionTyped.length < (predictionLine ?? '').length && <span className="inline-block w-1.5 h-4 bg-white/55 align-middle ml-0.5 animate-pulse" />}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Verdict body */}
          <AnimatePresence>
            {phase >= 4 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="max-w-2xl text-center text-white/85 text-[16px] md:text-[18px] leading-relaxed mb-8 font-mono min-h-[3em]"
              >
                {typed}
                {typed.length < verdictText.length && <span className="inline-block w-2 h-5 bg-white/85 align-middle ml-1 animate-pulse" />}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Winner card */}
          <AnimatePresence>
            {phase >= 5 && (
              <motion.div
                initial={{ y: 20, opacity: 0, scale: 0.9 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 220, damping: 18 }}
                className="glass-elev px-6 py-5 max-w-md w-full text-center"
                style={{
                  boxShadow: '0 0 0 1px rgba(255,184,48,0.55) inset, 0 0 80px rgba(255,184,48,0.45)',
                  background: 'linear-gradient(180deg, rgba(255,184,48,0.10), rgba(255,184,48,0.02))',
                }}
              >
                <div className="text-[10px] tracking-widest text-yellow-300 font-bold mb-1">★ WINNER</div>
                <div className="text-[36px] font-black tracking-tight text-white" style={{ color: meta.color }}>{meta.name}</div>
                <div className="text-[11px] tracking-widest text-white/50 font-mono mb-3">{meta.algorithm}</div>
                <div className="text-[14px] text-white/85 font-mono">SCORE <span className="text-yellow-200 font-extrabold tabular-nums ml-1">{winnerScore.toFixed(1)}</span></div>

                {/* payout */}
                <AnimatePresence>
                  {phase >= 6 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 pt-4 border-t border-yellow-300/20"
                    >
                      <div className="text-[10px] tracking-widest text-white/45 font-mono mb-1">PAYOUT</div>
                      <PayoutCounter target={payoutUsdc} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Receipt bar */}
          <AnimatePresence>
            {phase >= 7 && (
              <motion.div
                initial={{ y: 60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 60, opacity: 0 }}
                className="glass mt-8 px-5 py-3 max-w-3xl w-full font-mono"
              >
                <div className="flex items-center justify-between gap-4 text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="text-white/30 tracking-widest">VERDICT HASH</span>
                    <span className="text-white/85 tabular-nums">{verdictHash.slice(0, 10)}…{verdictHash.slice(-6)}</span>
                  </div>
                  {txHash && (
                    <a
                      href={`https://sepolia.basescan.org/tx/${txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-accent hover:text-accent/80"
                    >
                      <span>BASESCAN</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {onDismiss && (
                    <button
                      onClick={onDismiss}
                      className="text-white/40 hover:text-white text-[10px] tracking-widest font-bold"
                    >
                      CONTINUE →
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PayoutCounter({ target }: { target: number }) {
  const [v, setV] = React.useState(0);
  React.useEffect(() => {
    const start = performance.now();
    const dur = 1100;
    const tick = (t: number) => {
      const e = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - e, 3);
      setV(target * eased);
      if (e < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target]);
  return (
    <div className="text-[28px] font-black text-yellow-200 tabular-nums tracking-tight">
      ${v.toFixed(2)} <span className="text-[12px] text-white/45 font-normal font-mono ml-1">USDC</span>
    </div>
  );
}
