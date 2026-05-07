/**
 * Client-side simulated race — emits the same SSE event sequence the backend
 * would, entirely in the browser. Used on GitHub Pages where there is no
 * backend. The full broadcast UI runs unchanged: launcher → arena → verdict.
 *
 * Timing roughly matches the real race so the demo cinematography lands.
 */
import type { AgentId } from '../types';

export type MockEventListener = (event: any) => void;

interface MockHandle {
  bountyId: string;
  cancel: () => void;
}

export function isStaticHost(): boolean {
  if (typeof window === 'undefined') return false;
  if (/github\.io$/i.test(window.location.hostname)) return true;
  // Manual override for local testing: ?mock=1
  if (typeof URLSearchParams !== 'undefined') {
    const p = new URLSearchParams(window.location.search);
    if (p.get('mock') === '1') return true;
  }
  return false;
}

let activeListener: MockEventListener | null = null;
let active: MockHandle | null = null;
// Buffer events emitted before the consumer subscribes (the BroadcastArena
// mounts a tick *after* startBounty kicks off the race).
const pendingEvents: any[] = [];

export function subscribeMock(_bountyId: string, listener: MockEventListener) {
  activeListener = listener;
  // Flush any events that fired before subscription
  while (pendingEvents.length) {
    const evt = pendingEvents.shift();
    listener(evt);
  }
  return () => { if (activeListener === listener) activeListener = null; };
}

function emit(payload: any, type: string, bountyId: string) {
  const evt = { id: cryptoUuid(), bountyId, type, timestamp: new Date().toISOString(), payload };
  if (activeListener) activeListener(evt);
  else pendingEvents.push(evt);
}

function cryptoUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return (crypto as any).randomUUID();
  return Math.random().toString(36).slice(2);
}

function fakeTx(): string {
  // Realistic-looking tx hash so basescan links don't 404 immediately on hover-preview;
  // they will return "tx not found" if clicked, but the format matches.
  let h = '0x';
  for (let i = 0; i < 64; i++) h += '0123456789abcdef'[Math.floor(Math.random() * 16)];
  return h;
}

const REAL_TXS = {
  // Real txs from production runs — these DO resolve on basescan
  bountyFund: '0x3f7915d269ed46d404e01020057eadf3cce7c2e00d14bfdf89436f15b1231582',
  scout:      '0xe316eb7e6ede2f77617b72fd31a7d117808d7c139f1f5b08fe3f231e15337046',
  drill:      '0x31470ed4a3c57c2d65cd2c765b91a301f54583d9b92e5bd3d59c066024f818af',
  compass:    '0x15df94c6fdc94988a32e3837d928b58ad32e9bb0888c0eaeea5761af0497ccd5',
  dice:       '0x9f36949637c4005af7f7c15b5a9fda7baff4b305fcc0a10cdac1d4c1e29ea12f',
  dash:       '0x281a2ce08d592266c378a4d69274671a4d9c8f60cbe0ed5b0b5450524ec2e267',
  payout:     '0x9eac34738f7a8d594cc1fe6adab70c6178a54112b83339ad34ed1dca212604a0',
  verdict:    '0xa2334928531fbca8c3755879aae6ff2175d663f4dd06a641a7d430e27b9d7023',
};

const VERDICT_HASH = '3e65379a4d71b58f48f4bfdb61ed30b199f4d563416e53f78b5c470197ba975e';

export function startMockRace(bountyId: string, budgetUsdc: number, title: string): MockHandle {
  if (active) active.cancel();
  // Clear stale buffered events from any previous race
  pendingEvents.length = 0;

  const timers: ReturnType<typeof setTimeout>[] = [];
  const cancelled = { v: false };
  const at = (ms: number, fn: () => void) => {
    timers.push(setTimeout(() => { if (!cancelled.v) fn(); }, ms));
  };

  const E = (type: string, payload: any = {}, ms = 0) => at(ms, () => emit(payload, type, bountyId));

  // ---- Sequence — mimics raceEngine.ts timings ----
  // 0. Bounty created
  E('bounty.created', { id: bountyId, title, budgetUsdc }, 0);

  // 1. Bounty fund (hero payment)
  E('payment.started', {
    purpose: 'bounty_fund', isHero: true,
    from: '0xfdbb534eB0Ed764Cb743893177CFEf91c9CAF540',
    to: '0xfdbb534eB0Ed764Cb743893177CFEf91c9CAF540',
    amount: budgetUsdc.toFixed(2), asset: 'USDC',
    txHash: REAL_TXS.bountyFund, real: true,
  }, 200);

  // 2. Optimus classifying
  E('optimus.classifying', { message: 'Optimus is analyzing the bounty description...' }, 1000);
  E('optimus.classified', {
    problemType: 'depth-investigation',
    expectedWinnerAgentId: 'drill',
    confidence: 0.55,
    classificationReason: 'Bounty appears to require deep investigation. DFS commits to a path and maximizes depth of analysis.',
  }, 1900);

  // 3. Dispatch
  E('bounty.dispatched', { agentIds: ['scout','drill','compass','dice','dash'] }, 2200);

  // 4. Queue agents + per-agent x402 payments (signing → verified)
  const AGENTS: AgentId[] = ['scout','drill','compass','dice','dash'];
  AGENTS.forEach((id, i) => {
    const t0 = 2400 + i * 200;
    E('agent.queued', { agentId: id, algorithm: id }, t0);
    E('agent.payment', { agentId: id, endpoint: '/data/defi-protocols', amount: 0.001, status: 'signing' }, t0 + 400);
    E('agent.payment', {
      agentId: id, endpoint: '/data/defi-protocols', amount: 0.001,
      status: 'verified', txHash: REAL_TXS[id], real: true,
    }, t0 + 1500);
  });

  // 5. Running phase — staggered submission times (matches real agent timing)
  const RUN_START = 4500;
  const SUBMIT_TIMES: Record<AgentId, number> = {
    dash:    RUN_START + 6000,    // greedy is fastest
    scout:   RUN_START + 17000,
    compass: RUN_START + 22000,
    dice:    RUN_START + 26000,
    drill:   RUN_START + 32000,   // DFS slowest
  };

  AGENTS.forEach((id) => {
    E('agent.running', { agentId: id, progress: 0 }, RUN_START);
    // Progress every 2s
    for (let p = 10; p <= 95; p += 12) {
      E('agent.progress', { agentId: id, progress: p, message: `${id} running…` }, RUN_START + (p / 95) * (SUBMIT_TIMES[id] - RUN_START));
    }
    E('agent.submitted', { agentId: id, progress: 100, elapsedMs: SUBMIT_TIMES[id] - 200 }, SUBMIT_TIMES[id]);
  });

  // 6. Audit phase — runs after all submitted; Drill fails depth check
  const AUDIT_START = SUBMIT_TIMES.drill + 1500;
  AGENTS.forEach((id, i) => {
    const t = AUDIT_START + i * 600;
    if (id === 'drill') {
      E('agent.audit_check', { agentId: id, rule: 'committedToPath', passed: true, detail: 'OK' }, t);
      E('agent.audit_check', { agentId: id, rule: 'minDfsDepth3', passed: false, detail: 'reached only depth 2' }, t + 250);
      E('agent.audit_failed', { agentId: id, reason: 'DFS depth constraint violated (depth=2 < min=3)' }, t + 500);
      E('agent.disqualified', { agentId: id, reason: 'audit_failed' }, t + 700);
    } else {
      E('agent.audit_check', { agentId: id, rule: 'algorithmCompliance', passed: true, detail: 'OK' }, t);
      E('agent.audit_check', { agentId: id, rule: 'minimumWork', passed: true, detail: 'OK' }, t + 200);
      E('agent.audit_passed', { agentId: id }, t + 400);
    }
  });

  // 7. Scoring
  const SCORE_START = AUDIT_START + AGENTS.length * 600 + 800;
  const SCORES: Record<AgentId, any> = {
    compass: { constraintCompliance: 20, answerQuality: 19, methodologyFit: 17, evidenceQuality: 14, coverageDepth: 11, reasoningClarity: 9, speedCostEfficiency: 4, total: 92 },
    dice:    { constraintCompliance: 18, answerQuality: 18, methodologyFit: 14, evidenceQuality: 13, coverageDepth: 10, reasoningClarity: 8, speedCostEfficiency: 4, total: 85 },
    scout:   { constraintCompliance: 18, answerQuality: 17, methodologyFit: 13, evidenceQuality: 13, coverageDepth: 12, reasoningClarity: 8, speedCostEfficiency: 4, total: 85 },
    dash:    { constraintCompliance: 16, answerQuality: 14, methodologyFit: 12, evidenceQuality: 11, coverageDepth: 8,  reasoningClarity: 7, speedCostEfficiency: 5, total: 73 },
    drill:   { constraintCompliance: 6,  answerQuality: 12, methodologyFit: 10, evidenceQuality: 10, coverageDepth: 8,  reasoningClarity: 6, speedCostEfficiency: 2, total: 54 },
  };
  AGENTS.forEach((id, i) => {
    if (id === 'drill') return; // already disqualified — no score
    const t = SCORE_START + i * 400;
    E('agent.scored', { agentId: id, scoreBreakdown: SCORES[id] }, t);
  });

  // 8. Judging + verdict
  const VERDICT_START = SCORE_START + AGENTS.length * 400 + 1200;
  E('optimus.judging', {}, VERDICT_START);
  E('optimus.verdict', {
    winnerAgentId: 'compass',
    rationale:
      'Compass won this depth-investigation task with a score of 92.0/100. Its A* heuristic search produced the strongest combination of constraint compliance, evidence quality, and methodology fit. Scout covered 15 candidates but lacked the ranking heuristic depth. Optimus predicted Drill (confidence 55%) — but Compass outperformed via algorithm fit the classifier underweighted.',
    predictionCorrect: false,
    expectedAgentId: 'drill',
    problemType: 'depth-investigation',
  }, VERDICT_START + 2200);

  // 9. Winner payout
  E('payment.started', {
    purpose: 'winner_payout',
    from: '0xfdbb534eB0Ed764Cb743893177CFEf91c9CAF540',
    to: '0xfdbb534eB0Ed764Cb743893177CFEf91c9CAF540',
    amount: budgetUsdc.toFixed(2), asset: 'USDC', agentId: 'compass',
  }, VERDICT_START + 3000);
  E('payment.settled', {
    txHash: REAL_TXS.payout, amount: budgetUsdc.toFixed(2),
    agentId: 'compass', real: true,
  }, VERDICT_START + 4500);

  // 10. Proof hash + on-chain publish
  E('proof.hash_created', { verdictHash: VERDICT_HASH }, VERDICT_START + 5500);
  E('proof.onchain_published', {
    txHash: REAL_TXS.verdict,
    network: 'eip155:84532',
    contractAddress: '0xad6870E90311BB5CA2f03CC16DAa5b447618F56E',
  }, VERDICT_START + 6800);

  // 11. Done
  E('bounty.completed', { elapsedMs: VERDICT_START + 7000 }, VERDICT_START + 7000);

  active = {
    bountyId,
    cancel: () => {
      cancelled.v = true;
      timers.forEach(clearTimeout);
      if (active?.bountyId === bountyId) active = null;
    },
  };
  return active;
}

export function cancelMockRace() {
  if (active) active.cancel();
}
