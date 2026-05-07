import React from 'react';

/**
 * Full-bleed broadcast canvas: deep-space gradient + drifting colored orbs.
 * All UI sits on top of this on z-10+.
 */
export function BroadcastShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-broadcast bg-orbs min-h-screen w-full overflow-hidden relative">
      <div className="orb orb-violet" />
      <div className="relative z-10 h-screen flex flex-col">{children}</div>
    </div>
  );
}
