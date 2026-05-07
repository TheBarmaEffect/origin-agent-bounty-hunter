import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hexagon } from 'lucide-react';

interface Props {
  open: boolean;
  onDone?: () => void;
  durationMs?: number;
}

const LINES = [
  { t: 0,    text: '5 AGENTS' },
  { t: 600,  text: '1 BOUNTY' },
  { t: 1200, text: 'REAL MONEY ON BASE SEPOLIA' },
  { t: 2000, text: 'WATCH.' },
];

export function IntroSplash({ open, onDone, durationMs = 2800 }: Props) {
  const [active, setActive] = React.useState(0);

  const onDoneRef = React.useRef(onDone);
  onDoneRef.current = onDone;
  React.useEffect(() => {
    if (!open) return;
    const timers = LINES.map((l, i) => setTimeout(() => setActive(i + 1), l.t));
    const finish = setTimeout(() => onDoneRef.current?.(), durationMs);
    return () => { timers.forEach(clearTimeout); clearTimeout(finish); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, durationMs]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.5 } }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[60] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(20px)' }}
        >
          <div className="text-center">
            <motion.div
              initial={{ scale: 0.6, rotate: -30, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 16 }}
              className="mb-8 inline-block"
            >
              <Hexagon className="w-14 h-14 text-brand mx-auto" strokeWidth={1.5} />
            </motion.div>

            <div className="space-y-3">
              {LINES.map((l, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: i < active ? 1 : 0, y: i < active ? 0 : 8 }}
                  transition={{ duration: 0.4 }}
                  className={
                    i === LINES.length - 1
                      ? 'text-[44px] md:text-[56px] font-black tracking-tight text-brand mt-4'
                      : 'text-[18px] md:text-[22px] font-extrabold tracking-[0.2em] text-white/85 font-mono'
                  }
                  style={i === LINES.length - 1 ? { letterSpacing: '-0.02em' } : undefined}
                >
                  {l.text}
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
