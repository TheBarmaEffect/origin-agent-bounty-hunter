import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PaymentState } from '../types';

const STEPS = [
  { stage: 'started', label: 'Initiating x402 payment...', icon: '⚡' },
  { stage: 'challenge', label: 'Challenge received...', icon: '🔐' },
  { stage: 'settled', label: 'USDC settled to winner wallet', icon: '✅' },
];

interface Props {
  payment: PaymentState;
  winnerName?: string;
}

export function PaymentFlow({ payment, winnerName }: Props) {
  if (payment.stage === 'idle') return null;

  const currentIdx = STEPS.findIndex(s => s.stage === payment.stage);
  const failed = payment.stage === 'failed';

  return (
    <div className="mt-3 p-3 rounded-lg bg-slate-900/80 border border-audit/30">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-bold text-audit tracking-widest">PAYMENT</span>
        {payment.demoMode && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 font-bold tracking-wider">DEMO</span>
        )}
      </div>

      {failed ? (
        <div className="text-xs text-lose font-semibold">Payment failed</div>
      ) : (
        <div className="space-y-2">
          {STEPS.map((step, idx) => {
            const isActive = idx === currentIdx;
            const isDone = idx < currentIdx || payment.stage === 'settled';
            const isPending = idx > currentIdx && payment.stage !== 'settled';
            return (
              <motion.div
                key={step.stage}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: isPending ? 0.3 : 1, x: 0 }}
                transition={{ delay: idx * 0.2 }}
                className="flex items-center gap-2"
              >
                <span className="text-base">{step.icon}</span>
                <span
                  className={`text-xs font-mono ${
                    isDone ? 'text-win' : isActive ? 'text-audit animate-pulse' : 'text-slate-600'
                  }`}
                >
                  {step.label}
                  {step.stage === 'settled' && winnerName ? ` (${winnerName})` : ''}
                </span>
                {isDone && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-win text-xs ml-auto"
                  >
                    ✓
                  </motion.span>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {payment.txHash && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-2 pt-2 border-t border-slate-800"
        >
          <span className="text-[9px] text-slate-500 font-mono">
            TX: {payment.txHash.slice(0, 10)}...{payment.txHash.slice(-8)}
          </span>
        </motion.div>
      )}

      {payment.amount && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-2 text-sm font-bold text-win text-center"
        >
          ${payment.amount} USDC
        </motion.div>
      )}
    </div>
  );
}
