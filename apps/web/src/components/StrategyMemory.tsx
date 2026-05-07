import React from 'react';
import { motion } from 'framer-motion';
import { StrategyStats, AgentId } from '../types';

const AGENT_NAMES: Record<AgentId, string> = {
  scout: 'SCOUT',
  drill: 'DRILL',
  compass: 'COMPASS',
  dice: 'DICE',
  dash: 'DASH',
};

const AGENT_EMOJIS: Record<AgentId, string> = {
  scout: '🔭',
  drill: '🔩',
  compass: '🧭',
  dice: '🎲',
  dash: '💨',
};

interface Props {
  stats: StrategyStats[];
}

export function StrategyMemory({ stats }: Props) {
  if (stats.length === 0) return null;

  const byAgent: Record<string, StrategyStats[]> = {};
  for (const s of stats) {
    if (!byAgent[s.agentId]) byAgent[s.agentId] = [];
    byAgent[s.agentId].push(s);
  }

  const agentSummaries = Object.entries(byAgent).map(([agentId, agentStats]) => {
    const totalWins = agentStats.reduce((s, x) => s + x.wins, 0);
    const totalLosses = agentStats.reduce((s, x) => s + x.losses, 0);
    const totalDQ = agentStats.reduce((s, x) => s + x.disqualifications, 0);
    const totalRaces = agentStats.reduce((s, x) => s + x.totalRaces, 0);
    const avgScore = totalRaces > 0
      ? agentStats.reduce((s, x) => s + x.averageScore * x.totalRaces, 0) / totalRaces
      : 0;
    const winRate = totalRaces > 0 ? (totalWins / totalRaces) * 100 : 0;
    return { agentId: agentId as AgentId, totalWins, totalLosses, totalDQ, totalRaces, avgScore, winRate };
  });

  return (
    <div className="mt-4 p-4 rounded-xl border border-border bg-surface">
      <div className="text-xs font-black tracking-widest text-slate-400 mb-3">
        STRATEGY MEMORY
        <span className="ml-2 text-[9px] text-slate-600 font-normal">cumulative reputation</span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {agentSummaries.map(({ agentId, totalWins, totalLosses, totalDQ, totalRaces, avgScore, winRate }, i) => (
          <motion.div
            key={agentId}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-center"
          >
            <div className="text-xl mb-1">{AGENT_EMOJIS[agentId]}</div>
            <div className="text-[9px] font-black text-slate-300 tracking-wider mb-2">{AGENT_NAMES[agentId]}</div>

            <div className="space-y-1">
              <div className="flex justify-between text-[9px]">
                <span className="text-slate-600">W</span>
                <span className="text-win font-bold">{totalWins}</span>
              </div>
              <div className="flex justify-between text-[9px]">
                <span className="text-slate-600">L</span>
                <span className="text-slate-400">{totalLosses}</span>
              </div>
              <div className="flex justify-between text-[9px]">
                <span className="text-slate-600">DQ</span>
                <span className="text-lose/70">{totalDQ}</span>
              </div>
              <div className="pt-1 border-t border-slate-800">
                <div className="text-[9px] text-slate-500 mb-0.5">avg score</div>
                <div
                  className="text-xs font-black"
                  style={{ color: avgScore >= 70 ? '#10b981' : avgScore >= 50 ? '#f59e0b' : '#64748b' }}
                >
                  {Math.round(avgScore)}
                </div>
              </div>
              {totalRaces > 0 && (
                <div className="text-[9px] text-slate-600">{winRate.toFixed(0)}% win</div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
