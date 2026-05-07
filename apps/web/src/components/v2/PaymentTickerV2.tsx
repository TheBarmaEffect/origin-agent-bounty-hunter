import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink } from 'lucide-react';
import type { AgentId } from '../../types';
import { AGENTS } from '../../lib/agents';
import { cn } from '../../lib/cn';

export type TickerStatus = 'pending' | 'signing' | 'verified' | 'failed';

export interface PaymentEvent {
  id: string;
  agentId: AgentId | 'user' | 'optimus';
  endpoint: string;          // e.g. "/data/defi-protocols"
  amountUsdc: number;
  status: TickerStatus;
  txHash?: string;
  isHero?: boolean;          // bounty funded — full-width highlight
  timestamp: number;
}

interface Props {
  events: PaymentEvent[];
  totalSpent: number;
  maxRows?: number;
}

/**
 * Stock-exchange tape for x402 payments.
 * Hero events (bounty funded) get a full-width highlight at the top.
 */
export function PaymentTickerV2({ events, totalSpent, maxRows = 6 }: Props) {
  const hero = events.find(e => e.isHero);
  const tape = events.filter(e => !e.isHero).slice(-maxRows).reverse();

  return (
    <div className="glass p-3 w-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          <span className="text-[10px] font-extrabold tracking-[0.25em] text-white/80">x402 PAYMENT RAIL</span>
        </div>
        <span className="text-[9px] text-white/30 font-mono">BASE SEPOLIA</span>
      </div>

      <AnimatePresence>
        {hero && <HeroPayment evt={hero} />}
      </AnimatePresence>

      <div className="flex flex-col gap-1.5">
        <AnimatePresence initial={false}>
          {tape.map((e) => <TickerRow key={e.id} evt={e} />)}
        </AnimatePresence>
      </div>

      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between font-mono">
        <span className="text-[10px] text-white/40 tracking-widest">TOTAL SPENT</span>
        <motion.span
          key={totalSpent.toFixed(4)}
          initial={{ scale: 0.94, color: '#22C55E' }}
          animate={{ scale: 1, color: '#FFFFFF' }}
          transition={{ duration: 0.4 }}
          className="text-[14px] font-extrabold tabular-nums"
        >
          ${totalSpent.toFixed(4)} <span className="text-white/40 font-normal text-[10px]">USDC</span>
        </motion.span>
      </div>
    </div>
  );
}

function HeroPayment({ evt }: { evt: PaymentEvent }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="mb-3 p-3 rounded-xl"
      style={{
        background: 'linear-gradient(135deg, rgba(59,139,255,0.18), rgba(59,139,255,0.06))',
        border: '1px solid rgba(59,139,255,0.40)',
        boxShadow: '0 0 24px rgba(59,139,255,0.15)',
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
        <span className="text-[9px] font-extrabold tracking-widest text-accent">⬡ BOUNTY FUNDED</span>
      </div>
      <div className="text-[12px] font-mono text-white/85 flex items-center gap-2">
        <span className="text-white/55">User</span>
        <span className="text-white/30">→</span>
        <span>Origin Escrow</span>
        <span className="text-emerald-300 font-extrabold tabular-nums ml-auto">${evt.amountUsdc.toFixed(2)} USDC</span>
      </div>
      {evt.txHash && (
        <a
          href={`https://sepolia.basescan.org/tx/${evt.txHash}`}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-[10px] text-accent/80 hover:text-accent font-mono"
        >
          {evt.txHash.slice(0, 10)}…{evt.txHash.slice(-4)}
          <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </motion.div>
  );
}

function TickerRow({ evt }: { evt: PaymentEvent }) {
  const meta = evt.agentId in AGENTS ? AGENTS[evt.agentId as AgentId] : null;
  const dotColor = meta?.color ?? '#9CA3AF';
  const rgb = meta?.rgb ?? '156,163,175';

  const status = STATUS_MAP[evt.status];

  const flash =
    evt.status === 'verified'
      ? { background: 'rgba(34,197,94,0.10)' }
      : evt.status === 'failed'
        ? { background: 'rgba(255,68,85,0.10)' }
        : evt.status === 'signing'
          ? { background: 'rgba(245,158,11,0.06)' }
          : { background: 'rgba(255,255,255,0.025)' };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0, ...flash }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 rounded-lg font-mono text-[11px]',
        evt.status === 'failed' && 'animate-shake'
      )}
      style={{ border: '1px solid rgba(255,255,255,0.04)' }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{
          background: dotColor,
          boxShadow: `0 0 6px ${dotColor}`,
          animation: evt.status === 'pending' || evt.status === 'signing' ? 'pulse-soft 1.4s ease-in-out infinite' : undefined,
        }}
      />
      <span
        className="text-[10px] font-extrabold tracking-widest shrink-0"
        style={{ color: dotColor, background: `rgba(${rgb},0.10)`, padding: '2px 6px', borderRadius: 4 }}
      >
        {(meta?.name ?? evt.agentId).toUpperCase().slice(0, 8)}
      </span>
      <span className="text-white/30 shrink-0">→</span>
      <span className="text-white/65 truncate flex-1">{evt.endpoint}</span>
      <span className="text-white/85 tabular-nums shrink-0">${evt.amountUsdc.toFixed(3)}</span>
      <span className={cn('shrink-0 text-[9px] font-bold tracking-widest', status.tone)}>
        {status.label}
      </span>
      {evt.txHash && evt.status === 'verified' && (
        <a
          href={`https://sepolia.basescan.org/tx/${evt.txHash}`}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-emerald-300/80 hover:text-emerald-300"
        >
          <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </motion.div>
  );
}

const STATUS_MAP: Record<TickerStatus, { label: string; tone: string }> = {
  pending:  { label: 'PENDING',     tone: 'text-white/40' },
  signing:  { label: 'SIGNING…',    tone: 'text-amber-300' },
  verified: { label: 'VERIFIED ✓',  tone: 'text-emerald-300' },
  failed:   { label: 'FAILED ✗',    tone: 'text-rose-300' },
};
