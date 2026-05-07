import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BountyRace, AgentId } from '../types';
import { ScoreBar } from './ScoreBar';
import { replayBounty } from '../lib/api';

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
  race: BountyRace;
  onReplay: (bountyId: string) => void;
  onNew: () => void;
}

function useTypewriter(text: string, speed = 12) {
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
  }, [text]);
  return displayed;
}

export function VerdictReceipt({ race, onReplay, onNew }: Props) {
  const [replaying, setReplaying] = useState(false);
  const winner = race.winnerAgentId ? race.agents[race.winnerAgentId] : null;
  const verdictHash = race.proof.verdictHash || '';
  const typedHash = useTypewriter(verdictHash, 14);

  const agentsByScore = (Object.values(race.agents) as typeof race.agents[AgentId][]).sort((a, b) => {
    if (a.status === 'disqualified' && b.status !== 'disqualified') return 1;
    if (b.status === 'disqualified' && a.status !== 'disqualified') return -1;
    return (b.score?.total ?? 0) - (a.score?.total ?? 0);
  });

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(race, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `verdict-${race.bountyId.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReplay = async () => {
    setReplaying(true);
    try {
      const newBounty = await replayBounty(race.bountyId);
      onReplay(newBounty.bountyId);
    } catch {
      setReplaying(false);
    }
  };

  return (
    <div className="min-h-screen p-6 flex flex-col items-center">
      <div className="w-full max-w-3xl">
        {/* Winner Hero */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="text-[10px] font-bold tracking-widest text-slate-500 mb-4">BOUNTY COMPLETE</div>

          {winner ? (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="inline-block"
            >
              <div className="text-6xl mb-3">{AGENT_EMOJIS[winner.agentId]}</div>
              <div className="text-4xl font-black text-yellow-400 tracking-widest mb-1">
                {AGENT_NAMES[winner.agentId]}
              </div>
              <div className="text-sm text-yellow-600 font-bold">WINS THE BOUNTY</div>
              <div className="text-2xl font-black text-win mt-2">${race.budgetUsdc} USDC</div>
            </motion.div>
          ) : (
            <div className="text-xl text-slate-500">No winner determined</div>
          )}
        </motion.div>

        {/* Prediction result */}
        {race.predictionCorrect !== undefined && race.classification && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className={`mb-6 p-3 rounded-xl border text-center ${
              race.predictionCorrect
                ? 'border-win/30 bg-win/5 text-win'
                : 'border-lose/30 bg-lose/5 text-lose'
            }`}
          >
            <span className="text-sm font-bold">
              Prediction {race.predictionCorrect ? 'CORRECT ✓' : 'INCORRECT ✗'}
            </span>
            <span className="text-xs text-slate-500 ml-2">
              (expected {AGENT_NAMES[race.classification.expectedWinnerAgentId]})
            </span>
          </motion.div>
        )}

        {/* Rationale */}
        {race.rationale && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="mb-6 p-4 rounded-xl border border-border bg-surface"
          >
            <div className="text-[10px] font-bold tracking-widest text-slate-500 mb-2">OPTIMUS RATIONALE</div>
            <p className="text-xs text-slate-400 leading-relaxed font-mono">{race.rationale}</p>
          </motion.div>
        )}

        {/* Score table */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-6 space-y-3"
        >
          <div className="text-[10px] font-bold tracking-widest text-slate-500">FINAL SCORES</div>
          {agentsByScore.map((agent, idx) => {
            const isWon = agent.agentId === race.winnerAgentId;
            const isDQ = agent.status === 'disqualified';
            return (
              <motion.div
                key={agent.agentId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + idx * 0.06 }}
                className={`p-4 rounded-xl border ${
                  isWon ? 'border-yellow-400/40 bg-yellow-900/10 winner-card' : isDQ ? 'border-lose/20 bg-lose/5 opacity-50' : 'border-border bg-surface'
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xl">{AGENT_EMOJIS[agent.agentId]}</span>
                  <div className="flex-1">
                    <div className={`text-sm font-black ${isDQ ? 'line-through text-slate-600' : isWon ? 'text-yellow-300' : 'text-slate-200'}`}>
                      {AGENT_NAMES[agent.agentId]}
                    </div>
                    <div className="text-[9px] text-slate-500">{agent.algorithm}</div>
                  </div>
                  {isDQ ? (
                    <span className="text-xs text-lose font-bold px-2 py-1 rounded bg-lose/10">DQ</span>
                  ) : isWon ? (
                    <span className="text-sm">🏆</span>
                  ) : null}
                </div>

                {agent.score ? (
                  <ScoreBar score={agent.score} />
                ) : isDQ ? (
                  <div className="text-[10px] text-lose/60">{agent.disqualificationReason}</div>
                ) : null}
              </motion.div>
            );
          })}
        </motion.div>

        {/* Proof */}
        {verdictHash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mb-6 p-4 rounded-xl border border-brand/30 bg-surface"
          >
            <div className="text-[10px] font-bold tracking-widest text-slate-500 mb-1">VERDICT HASH</div>
            <div className="font-mono text-[10px] text-slate-400 break-all select-all cursor-text leading-relaxed">
              {typedHash}
              {typedHash.length < verdictHash.length && <span className="animate-pulse">|</span>}
            </div>
            {race.proof.network && (
              <div className="mt-2">
                <span className={`text-[9px] px-2 py-0.5 rounded font-bold ${
                  race.proof.network.toLowerCase().includes('base') ? 'bg-win/20 text-win' : 'bg-slate-700 text-slate-400'
                }`}>
                  {race.proof.network.toUpperCase()}
                </span>
              </div>
            )}
          </motion.div>
        )}

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="flex gap-3"
        >
          <button
            onClick={handleDownload}
            className="flex-1 py-3 rounded-xl border border-border text-slate-400 text-xs font-bold tracking-widest hover:border-brand/40 hover:text-brand transition-all"
          >
            DOWNLOAD JSON
          </button>
          <button
            onClick={handleReplay}
            disabled={replaying}
            className="flex-1 py-3 rounded-xl border border-accent/30 text-accent text-xs font-bold tracking-widest hover:bg-accent/10 transition-all disabled:opacity-50"
          >
            {replaying ? 'REPLAYING...' : 'REPLAY RACE'}
          </button>
          <button
            onClick={onNew}
            className="flex-1 py-3 rounded-xl bg-brand text-white text-xs font-bold tracking-widest hover:bg-brand/90 transition-all"
          >
            NEW BOUNTY
          </button>
        </motion.div>
      </div>
    </div>
  );
}
