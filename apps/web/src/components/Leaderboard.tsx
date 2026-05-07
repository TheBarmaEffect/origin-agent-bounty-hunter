import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AgentState, AgentId } from '../types';

const AGENT_NAMES: Record<AgentId, string> = {
  scout: 'SCOUT',
  drill: 'DRILL',
  compass: 'COMPASS',
  dice: 'DICE',
  dash: 'DASH',
};

const ALGORITHMS: Record<AgentId, string> = {
  scout: 'BFS',
  drill: 'DFS',
  compass: 'A*',
  dice: 'Monte Carlo',
  dash: 'Greedy',
};

interface Props {
  agents: Record<AgentId, AgentState>;
  winnerId?: AgentId;
}

export function Leaderboard({ agents, winnerId }: Props) {
  const agentList = Object.values(agents);

  const ranked = [...agentList]
    .filter(a => a.score || a.status === 'won' || a.status === 'lost' || a.status === 'disqualified')
    .sort((a, b) => {
      if (a.status === 'disqualified' && b.status !== 'disqualified') return 1;
      if (b.status === 'disqualified' && a.status !== 'disqualified') return -1;
      return (b.score?.total ?? 0) - (a.score?.total ?? 0);
    });

  if (ranked.length === 0) return null;

  return (
    <div className="mt-4 p-4 rounded-xl border border-border bg-surface">
      <div className="text-xs font-black tracking-widest text-slate-400 mb-3">LEADERBOARD</div>
      <div className="space-y-2">
        <AnimatePresence>
          {ranked.map((agent, idx) => {
            const isWinner = agent.agentId === winnerId || agent.status === 'won';
            const isDQ = agent.status === 'disqualified';
            const score = agent.score?.total ?? 0;

            return (
              <motion.div
                key={agent.agentId}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: isDQ ? 0.4 : 1, x: 0 }}
                className={`flex items-center gap-3 p-2 rounded-lg ${
                  isWinner ? 'bg-yellow-900/20 border border-yellow-400/30' : 'bg-slate-900/50'
                }`}
              >
                <span
                  className={`text-lg font-black tabular-nums w-6 text-center ${
                    isWinner ? 'text-yellow-400' : 'text-slate-600'
                  }`}
                >
                  {idx + 1}
                </span>

                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-bold ${isDQ ? 'line-through text-slate-600' : isWinner ? 'text-yellow-300' : 'text-slate-200'}`}>
                    {AGENT_NAMES[agent.agentId]}
                    <span className="ml-2 text-[9px] text-slate-600 font-normal">{ALGORITHMS[agent.agentId]}</span>
                  </div>
                  {isDQ && (
                    <div className="text-[9px] text-lose/60 truncate">{agent.disqualificationReason}</div>
                  )}
                </div>

                {isDQ ? (
                  <span className="text-[9px] text-lose font-bold px-2 py-0.5 rounded bg-lose/10">DQ</span>
                ) : (
                  <div className="text-right">
                    <div
                      className="text-sm font-black tabular-nums"
                      style={{ color: score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#64748b' }}
                    >
                      {Math.round(score)}
                    </div>
                    <div className="text-[9px] text-slate-600">pts</div>
                  </div>
                )}

                {isWinner && (
                  <span className="text-lg">🏆</span>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
