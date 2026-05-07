import React from 'react';
import { BroadcastShell } from '../BroadcastShell';
import { AgentCardV2 } from './AgentCardV2';
import { LeaderboardV2, LeaderboardPhase, LeaderboardRow } from './LeaderboardV2';
import { PaymentTickerV2, PaymentEvent } from './PaymentTickerV2';
import { OptimusPanelV2 } from './OptimusPanelV2';
import type { AgentState, AgentId } from '../../types';

function makeState(partial: Partial<AgentState> & { agentId: AgentId }): AgentState {
  return {
    algorithm: 'BFS',
    status: 'queued',
    progress: 0,
    progressLog: [],
    auditChecks: [],
    disqualified: false,
    ...partial,
  } as AgentState;
}

export function AgentCardShowcase() {
  const [phase, setPhase] = React.useState<LeaderboardPhase>('submission');

  // Cycle phases for showcase
  React.useEffect(() => {
    const seq: LeaderboardPhase[] = ['submission', 'scoring', 'reveal', 'final'];
    let i = 0;
    const t = setInterval(() => {
      i = (i + 1) % seq.length;
      setPhase(seq[i]);
    }, 4000);
    return () => clearInterval(t);
  }, []);

  const cards: Array<{
    title: string;
    state: AgentState;
    rank?: number;
    rankDelta?: number;
    isWinner?: boolean;
    isPredicted?: boolean;
    spendUsdc?: number;
    elapsedMs?: number;
  }> = [
    { title: 'Queued', state: makeState({ agentId: 'scout', algorithm: 'BFS', status: 'queued', progress: 0 }) },
    { title: 'Running 70%', state: makeState({ agentId: 'scout', algorithm: 'BFS', status: 'running', progress: 70 }), rank: 2, rankDelta: 1, spendUsdc: 0.003, elapsedMs: 8200 },
    { title: 'Submitted', state: makeState({ agentId: 'dash', algorithm: 'Greedy', status: 'submitted', progress: 100 }), rank: 1, rankDelta: 0, spendUsdc: 0.001, elapsedMs: 8000 },
    {
      title: 'Audit failed (Drill DFS violation)',
      state: makeState({
        agentId: 'drill', algorithm: 'DFS', status: 'audit_failed', progress: 100, disqualified: true,
        auditChecks: [
          { rule: 'committed_to_path', passed: true, detail: 'OK' },
          { rule: 'min_dfs_depth_3', passed: false, detail: 'reached only depth 2' },
        ],
      }), rank: 5, rankDelta: -4, spendUsdc: 0.012, elapsedMs: 39400,
    },
    {
      title: 'Scored (predicted)',
      state: makeState({
        agentId: 'dice', algorithm: 'Monte Carlo', status: 'scored', progress: 100,
        score: { constraintCompliance: 18, answerQuality: 18, methodologyFit: 16, evidenceQuality: 13, coverageDepth: 10, reasoningClarity: 8, speedCostEfficiency: 4, total: 87.0 },
        auditChecks: [{ rule: 'sample_count_>=10', passed: true, detail: '24 samples' }],
      }), rank: 2, rankDelta: 0, isPredicted: true, spendUsdc: 0.008, elapsedMs: 31800,
    },
    {
      title: 'Winner — Compass A*',
      state: makeState({
        agentId: 'compass', algorithm: 'A*', status: 'won', progress: 100,
        score: { constraintCompliance: 20, answerQuality: 19, methodologyFit: 17, evidenceQuality: 14, coverageDepth: 11, reasoningClarity: 9, speedCostEfficiency: 4, total: 94.2 },
        auditChecks: [
          { rule: 'heuristic_declared', passed: true, detail: 'sha256:f3a2…' },
          { rule: 'heuristic_immutable', passed: true, detail: 'no drift' },
        ],
      }), rank: 1, rankDelta: 2, isWinner: true, spendUsdc: 0.011, elapsedMs: 27300,
    },
  ];

  const leaderboard: LeaderboardRow[] = [
    { agentId: 'dash',    score: 71.2, submissionRank: 1, finalRank: 4, status: 'scored', isWinner: false },
    { agentId: 'scout',   score: 78.4, submissionRank: 2, finalRank: 3, status: 'scored', isWinner: false },
    { agentId: 'compass', score: 94.2, submissionRank: 3, finalRank: 1, status: 'won',    isWinner: true },
    { agentId: 'dice',    score: 87.0, submissionRank: 4, finalRank: 2, status: 'scored', isWinner: false },
    { agentId: 'drill',   score: 32.0, submissionRank: 5, finalRank: 5, status: 'audit_failed', isWinner: false },
  ];

  const payments: PaymentEvent[] = [
    { id: 'h', agentId: 'user', endpoint: '/escrow/fund', amountUsdc: 2.0, status: 'verified', txHash: '0xd3fbf787d1a9c7173e3f57dc8288e54809f44daf86dd41d1804e67c8e493cebd', isHero: true, timestamp: 1 },
    { id: 'a', agentId: 'compass', endpoint: '/data/defi-protocols', amountUsdc: 0.001, status: 'verified', txHash: '0xc9035faa56d11dcf0294882ca925b5be1c9d49f6c60e135a7a9f1f840683d205', timestamp: 2 },
    { id: 'b', agentId: 'scout',   endpoint: '/data/defi-protocols', amountUsdc: 0.001, status: 'verified', txHash: '0xabc',  timestamp: 3 },
    { id: 'c', agentId: 'dice',    endpoint: '/data/defi-protocols', amountUsdc: 0.001, status: 'signing', timestamp: 4 },
    { id: 'd', agentId: 'dash',    endpoint: '/data/defi-protocols', amountUsdc: 0.001, status: 'pending', timestamp: 5 },
    { id: 'e', agentId: 'drill',   endpoint: '/data/defi-protocols', amountUsdc: 0.001, status: 'failed',  timestamp: 6 },
  ];

  return (
    <BroadcastShell>
      <div className="px-6 py-5 overflow-y-auto scrollbar-thin">
        <div className="mb-5">
          <div className="text-[10px] tracking-[0.3em] text-brand font-bold mb-1">DESIGN SHOWCASE</div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Liquid Glass Broadcast — All Components</h1>
          <p className="text-sm text-white/40 mt-1 font-mono">
            Phase 3-6 | Leaderboard auto-cycles phases every 4s — current: <span className="text-brand font-bold">{phase.toUpperCase()}</span>
          </p>
        </div>

        <div className="grid grid-cols-12 gap-4">
          {/* LEFT — agent cards */}
          <div className="col-span-12 lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {cards.map((c, i) => (
              <div key={i}>
                <p className="text-[9px] tracking-widest text-white/30 font-mono mb-1.5 uppercase">{c.title}</p>
                <AgentCardV2 {...c} />
              </div>
            ))}
          </div>

          {/* RIGHT — Optimus panel */}
          <div className="col-span-12 lg:col-span-4 lg:row-span-2">
            <OptimusPanelV2
              status={phase === 'scoring' ? 'evaluating' : phase === 'reveal' || phase === 'final' ? 'verdict' : 'monitoring'}
              prediction={{ agentId: 'dice', confidence: 0.62, problemType: 'probabilistic-search', correct: phase === 'final' ? false : undefined }}
              rows={[
                { agentId: 'scout',   audits: [{ rule: 'min_breadth', passed: true, detail: '' }, { rule: 'queue_fifo', passed: true, detail: '' }, { rule: 'no_skip', passed: true, detail: '' }] },
                { agentId: 'drill',   audits: [{ rule: 'committed', passed: true, detail: '' }, { rule: 'min_depth', passed: false, detail: '' }, { rule: 'lifo', passed: true, detail: '' }], violated: true },
                { agentId: 'compass', audits: [{ rule: 'heuristic', passed: true, detail: '' }, { rule: 'immutable', passed: true, detail: '' }, { rule: 'declared', passed: true, detail: '' }],
                  score: { constraintCompliance: 20, answerQuality: 19, methodologyFit: 17, evidenceQuality: 14, coverageDepth: 11, reasoningClarity: 9, speedCostEfficiency: 4, total: 94.2 } },
                { agentId: 'dice',    audits: [{ rule: 'samples', passed: true, detail: '' }, { rule: 'seed', passed: true, detail: '' }, { rule: 'variance', passed: true, detail: '' }],
                  score: { constraintCompliance: 18, answerQuality: 18, methodologyFit: 16, evidenceQuality: 13, coverageDepth: 10, reasoningClarity: 8, speedCostEfficiency: 4, total: 87.0 } },
                { agentId: 'dash',    audits: [{ rule: 'no_revisit', passed: true, detail: '' }, { rule: 'first_fit', passed: true, detail: '' }, { rule: 'submitted', passed: true, detail: '' }],
                  score: { constraintCompliance: 16, answerQuality: 14, methodologyFit: 12, evidenceQuality: 11, coverageDepth: 9, reasoningClarity: 7, speedCostEfficiency: 2, total: 71.2 } },
              ]}
              memory={[
                { algo: 'A*',  taskType: 'Heuristic',     winRate: 71, trend: 'up' },
                { algo: 'BFS', taskType: 'Breadth',       winRate: 63, trend: 'flat' },
                { algo: 'MC',  taskType: 'Sparse',        winRate: 45, trend: 'up-up', highlight: phase === 'final' },
                { algo: 'GRD', taskType: 'Speed-critical',winRate: 58, trend: 'down' },
                { algo: 'DFS', taskType: 'Depth',         winRate: 49, trend: 'flat' },
              ]}
            />
          </div>

          {/* LEFT bottom — leaderboard + payment ticker */}
          <div className="col-span-12 lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            <LeaderboardV2 rows={leaderboard} phase={phase} />
            <PaymentTickerV2 events={payments} totalSpent={0.005} />
          </div>
        </div>
      </div>
    </BroadcastShell>
  );
}
