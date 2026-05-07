import React, { useState, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BountyLauncher } from './components/BountyLauncher';
import { BroadcastArena } from './components/v2/BroadcastArena';
import { VerdictReceipt } from './components/VerdictReceipt';
import { AgentCardShowcase } from './components/v2/AgentCardShowcase';
import { BountyRace } from './types';

type View = 'launcher' | 'arena' | 'verdict';

export default function App() {
  // Optional UI showcase route — visit /#showcase to see all component states
  const [hash, setHash] = useState(typeof window !== 'undefined' ? window.location.hash : '');
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const [view, setView] = useState<View>('launcher');
  const [bountyId, setBountyId] = useState<string | null>(null);
  const [bountyTitle, setBountyTitle] = useState<string>('');
  const [completedRace, setCompletedRace] = useState<BountyRace | null>(null);

  const handleBountyStart = useCallback((id: string) => {
    setBountyId(id);
    setBountyTitle('DeFi Research Bounty');
    setView('arena');
  }, []);

  const handleRaceComplete = useCallback((_race: BountyRace) => {
    // The verdict overlay IS the final screen now. After dismissal, go back to
    // the launcher so the user can start another bounty.
    setBountyId(null);
    setCompletedRace(null);
    setBountyTitle('');
    setView('launcher');
  }, []);

  const handleReplay = useCallback((newBountyId: string) => {
    setBountyId(newBountyId);
    setCompletedRace(null);
    setView('arena');
  }, []);

  const handleNew = useCallback(() => {
    setBountyId(null);
    setCompletedRace(null);
    setBountyTitle('');
    setView('launcher');
  }, []);

  if (hash.startsWith('#showcase')) return <AgentCardShowcase />;

  return (
    <div className="min-h-screen bg-bg text-slate-200 font-mono">
      <AnimatePresence mode="wait">
        {view === 'launcher' && (
          <motion.div
            key="launcher"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.25 }}
          >
            <BountyLauncher onStart={handleBountyStart} />
          </motion.div>
        )}

        {view === 'arena' && bountyId && (
          <motion.div
            key={`arena-${bountyId}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <BroadcastArena
              bountyId={bountyId}
              bountyTitle={bountyTitle}
              onComplete={handleRaceComplete}
            />
          </motion.div>
        )}

        {view === 'verdict' && completedRace && (
          <motion.div
            key="verdict"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <VerdictReceipt
              race={completedRace}
              onReplay={handleReplay}
              onNew={handleNew}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
