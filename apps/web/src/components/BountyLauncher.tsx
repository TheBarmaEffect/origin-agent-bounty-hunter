import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { createBounty, startBounty } from '../lib/api';
import { ArchitectureView } from './ArchitectureView';

const DEFAULT_DESCRIPTION = `Find the top 3 risk-adjusted DeFi protocols using current TVL, 24h volume, momentum, and risk signals. Produce a short investor-grade recommendation. Consider protocol category, chain diversification, and downside risk.`;

interface Props {
  onStart: (bountyId: string) => void;
}

export function BountyLauncher({ onStart }: Props) {
  const [description, setDescription] = useState(DEFAULT_DESCRIPTION);
  const [budget, setBudget] = useState(0.5);
  const [timeLimit, setTimeLimit] = useState(90);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const title = description.split('.')[0].trim().slice(0, 80) || 'DeFi Research Bounty';
      const bounty = await createBounty({
        title,
        description,
        budgetUsdc: budget,
        timeLimitSeconds: timeLimit,
      });
      // API returns { bounty: { id }, ... } — extract ID from either shape
      const bountyId = bounty.bountyId ?? bounty.bounty?.id;
      // Pass mock budget/title through for static-host (GitHub Pages) mode
      await startBounty(bountyId, (bounty as any)._mockBudget ?? budget, (bounty as any)._mockTitle ?? title);
      onStart(bountyId);
    } catch (err: any) {
      setError(err.message || 'Failed to start bounty');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-broadcast bg-orbs min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="orb orb-violet" />
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-2xl glass-elev p-8"
      >
        {/* Title */}
        <div className="text-center mb-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand/40 bg-brand/10 text-brand text-[10px] font-bold tracking-widest mb-4"
          >
            ⚡ POWERED BY x402 + BASE
          </motion.div>

          <h1 className="text-3xl font-black tracking-tight text-slate-100 mb-2 leading-tight">
            ORIGIN AGENT<br />
            <span className="text-brand">BOUNTY HUNTER</span>
          </h1>

          <p className="text-sm text-slate-500 font-mono">
            Post a bounty. Watch agents compete. Pay the winner.
          </p>
        </div>

        {/* Form */}
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onSubmit={handleSubmit}
          className="space-y-5"
        >
          {/* Description */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold tracking-widest text-slate-500">
              BOUNTY DESCRIPTION
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              required
              className="w-full rounded-xl border border-border bg-surface p-4 text-sm text-slate-300 font-mono resize-none
                focus:outline-none focus:border-brand/60 focus:ring-1 focus:ring-brand/30
                placeholder:text-slate-700 transition-all"
              placeholder="Describe your research bounty..."
            />
          </div>

          {/* Budget + Time limit */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold tracking-widest text-slate-500">
                BUDGET (USDC)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-bold">$</span>
                <input
                  type="number"
                  min={0.5}
                  max={100}
                  step={0.5}
                  value={budget}
                  onChange={e => setBudget(Number(e.target.value))}
                  className="w-full rounded-xl border border-border bg-surface pl-7 pr-4 py-3 text-sm text-slate-300 font-mono
                    focus:outline-none focus:border-brand/60 focus:ring-1 focus:ring-brand/30 transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold tracking-widest text-slate-500">
                TIME LIMIT (SEC)
              </label>
              <input
                type="number"
                min={30}
                max={600}
                step={10}
                value={timeLimit}
                onChange={e => setTimeLimit(Number(e.target.value))}
                className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-slate-300 font-mono
                  focus:outline-none focus:border-brand/60 focus:ring-1 focus:ring-brand/30 transition-all"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-lg border border-lose/40 bg-lose/10 text-lose text-sm font-mono"
            >
              {error}
            </motion.div>
          )}

          {/* Submit */}
          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: loading ? 1 : 1.02 }}
            whileTap={{ scale: loading ? 1 : 0.98 }}
            className={`
              w-full py-4 rounded-xl font-black text-sm tracking-widest transition-all
              ${loading
                ? 'bg-brand/30 text-brand/50 cursor-not-allowed'
                : 'bg-brand hover:bg-brand/90 text-white pulse-brand shadow-lg shadow-brand/25'
              }
            `}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-brand/40 border-t-brand rounded-full animate-spin" />
                LAUNCHING BOUNTY...
              </span>
            ) : (
              '⚡ START BOUNTY'
            )}
          </motion.button>
        </motion.form>

        {/* x402 note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6 p-4 rounded-xl border border-audit/20 bg-audit/5"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold tracking-widest text-audit">x402 PROTOCOL</span>
          </div>
          <p className="text-[10px] text-slate-500 leading-relaxed font-mono">
            Bounty execution unlocked via x402 payment protocol. Agents access paid data sources only after payment challenge is signed. Winner receives USDC directly via on-chain settlement.
          </p>
        </motion.div>

        {/* Architecture */}
        <ArchitectureView />
      </motion.div>
    </div>
  );
}
