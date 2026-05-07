import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ProofState } from '../types';

interface Props {
  proof: ProofState;
}

function useTypewriter(text: string, speed = 18) {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    if (!text) { setDisplayed(''); return; }
    setDisplayed('');
    let i = 0;
    const interval = setInterval(() => {
      setDisplayed(text.slice(0, i + 1));
      i++;
      if (i >= text.length) clearInterval(interval);
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);
  return displayed;
}

export function ProofReceipt({ proof }: Props) {
  if (!proof.verdictHash) return null;

  const displayedHash = useTypewriter(proof.verdictHash);
  const network = proof.network || 'LOCAL';
  const isOnchain = network.toLowerCase().includes('base') || network.toLowerCase().includes('sepolia');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 p-3 rounded-lg bg-slate-900/80 border border-brand/30"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-bold text-brand tracking-widest">PROOF</span>
        <span
          className={`text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider ${
            isOnchain ? 'bg-win/20 text-win' : 'bg-slate-700 text-slate-400'
          }`}
        >
          {isOnchain ? 'BASE SEPOLIA' : 'LOCAL PROOF MODE'}
        </span>
      </div>

      <div className="font-mono text-[9px] text-slate-400 break-all leading-relaxed select-all cursor-text">
        {displayedHash}
        {displayedHash.length < proof.verdictHash.length && (
          <span className="animate-pulse">|</span>
        )}
      </div>

      {proof.onchainTxHash && (
        <div className="mt-2 pt-2 border-t border-slate-800">
          <span className="text-[9px] text-slate-500 font-mono">
            Onchain TX: {proof.onchainTxHash.slice(0, 10)}...{proof.onchainTxHash.slice(-8)}
          </span>
        </div>
      )}
    </motion.div>
  );
}
