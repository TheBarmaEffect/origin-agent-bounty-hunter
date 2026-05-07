import React from 'react';

export function ArchitectureView() {
  return (
    <div className="my-6 p-5 rounded-xl border border-border bg-surface/60 font-mono text-xs text-slate-400">
      <div className="text-[9px] text-slate-600 font-bold tracking-widest mb-4">ARCHITECTURE</div>
      <div className="flex flex-col items-center gap-0 text-center">
        {/* Row 1 */}
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-lg border border-brand/40 bg-brand/10 text-brand text-xs font-bold">User</div>
          <div className="text-slate-600">→</div>
          <div className="px-3 py-1.5 rounded-lg border border-audit/40 bg-audit/10 text-audit text-xs font-bold">x402 Payment</div>
          <div className="text-slate-600">→</div>
          <div className="px-3 py-1.5 rounded-lg border border-accent/40 bg-accent/10 text-accent text-xs font-bold">Optimus Classifier</div>
        </div>

        {/* Arrow down */}
        <div className="text-slate-600 text-lg leading-none my-1">↓</div>

        {/* Row 2 */}
        <div className="flex items-center gap-1 flex-wrap justify-center">
          {['Scout·BFS', 'Drill·DFS', 'Compass·A*', 'Dice·Monte Carlo', 'Dash·Greedy'].map((agent, i) => (
            <React.Fragment key={agent}>
              <div className="px-2 py-1 rounded border border-slate-700 bg-slate-800/60 text-[10px] text-slate-300 font-bold whitespace-nowrap">
                {agent}
              </div>
              {i < 4 && <span className="text-slate-700 text-[10px]">·</span>}
            </React.Fragment>
          ))}
        </div>

        {/* Arrow down */}
        <div className="text-slate-600 text-lg leading-none my-1">↓</div>

        {/* Row 3 */}
        <div className="px-3 py-1.5 rounded-lg border border-win/30 bg-win/10 text-win text-xs font-bold">
          Paid Data Provider
        </div>

        {/* Arrow down */}
        <div className="text-slate-600 text-lg leading-none my-1">↓</div>

        {/* Row 4 */}
        <div className="px-3 py-1.5 rounded-lg border border-audit/40 bg-audit/10 text-audit text-xs font-bold">
          Optimus Audit + Score
        </div>

        {/* Arrow down */}
        <div className="text-slate-600 text-lg leading-none my-1">↓</div>

        {/* Row 5 */}
        <div className="px-3 py-1.5 rounded-lg border border-audit/40 bg-audit/10 text-audit text-xs font-bold">
          x402 Winner Payout
        </div>

        {/* Arrow down */}
        <div className="text-slate-600 text-lg leading-none my-1">↓</div>

        {/* Row 6 */}
        <div className="px-3 py-1.5 rounded-lg border border-brand/40 bg-brand/10 text-brand text-xs font-bold">
          Base Sepolia Proof
        </div>
      </div>
    </div>
  );
}
