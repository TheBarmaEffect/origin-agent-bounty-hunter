import React from 'react';
import { motion } from 'framer-motion';
import { Hexagon } from 'lucide-react';

interface Props {
  liveTitle?: string;
  elapsedSec?: number;
  totalSpent?: number;
  agentCount?: number;
  network?: string;
  isReplay?: boolean;
}

export function BroadcastHeader({
  liveTitle, elapsedSec = 0, totalSpent = 0, agentCount = 5, network = 'Base Sepolia', isReplay,
}: Props) {
  const mins = Math.floor(elapsedSec / 60);
  const secs = (elapsedSec % 60).toFixed(1).padStart(4, '0');

  return (
    <header className="glass relative h-14 mx-3 mt-3 px-4 flex items-center justify-between rounded-2xl">
      {/* LEFT: brand */}
      <div className="flex items-center gap-3">
        <Hexagon className="w-5 h-5 text-brand" strokeWidth={2.5} />
        <div className="flex items-baseline gap-2 font-mono">
          <span className="text-[13px] font-extrabold tracking-tight text-brand">ORIGIN</span>
          <span className="text-white/20">|</span>
          <span className="text-[12px] font-semibold tracking-wider text-white/85">AGENT BOUNTY HUNTER</span>
        </div>
      </div>

      {/* CENTER: live race */}
      {liveTitle && (
        <div className="hidden md:flex items-center gap-3 flex-1 justify-center max-w-md">
          <motion.span
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 1.4, repeat: Infinity }}
            className="inline-flex items-center gap-1.5 text-[10px] font-extrabold tracking-widest text-rose-400 font-mono"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            LIVE
          </motion.span>
          <span className="text-[12px] text-amber-200 font-mono truncate max-w-[18rem]" title={liveTitle}>
            {liveTitle.length > 40 ? liveTitle.slice(0, 40) + '…' : liveTitle}
          </span>
          <span className="text-[12px] text-white/85 font-mono tabular-nums tracking-tight">
            {mins.toString().padStart(2, '0')}:{secs}s
          </span>
        </div>
      )}

      {/* RIGHT: badges */}
      <div className="flex items-center gap-2 font-mono">
        {isReplay && (
          <span className="text-[9px] tracking-widest font-extrabold text-amber-300 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-400/30">
            ⟳ REPLAY
          </span>
        )}
        <span className="text-[9px] tracking-widest text-white/65 px-2 py-1 rounded-md bg-white/5 border border-white/10">
          {network.toUpperCase()}
        </span>
        <span className="text-[9px] tracking-widest text-white/65 px-2 py-1 rounded-md bg-white/5 border border-white/10">
          {agentCount} AGENTS
        </span>
        <span className="text-[10px] tracking-wide font-extrabold text-emerald-300 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-400/25 tabular-nums">
          ${totalSpent.toFixed(4)}
        </span>
      </div>
    </header>
  );
}
