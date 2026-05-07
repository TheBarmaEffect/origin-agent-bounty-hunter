import { isStaticHost, startMockRace } from './mockRace';

const BASE = '/api';

export async function createBounty(data: { title: string; description: string; budgetUsdc: number; timeLimitSeconds: number }) {
  if (isStaticHost()) {
    // No backend on GitHub Pages — synthesize a bounty id locally.
    const bountyId = `mock-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    return {
      bountyId,
      bounty: { id: bountyId, ...data, status: 'created', paymentStatus: 'unpaid' },
      paymentRequired: false,
      demoMode: true,
      _mockBudget: data.budgetUsdc,
      _mockTitle: data.title,
    };
  }
  const res = await fetch(`${BASE}/bounties`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || (err as any).message || `HTTP ${res.status}`);
  }
  const body = await res.json();
  return { bountyId: body.bounty?.id ?? body.bountyId, ...body };
}

export async function startBounty(bountyId: string, mockBudget?: number, mockTitle?: string) {
  if (isStaticHost()) {
    // Kick off the in-browser simulated race; events flow via subscribeMock.
    startMockRace(bountyId, mockBudget ?? 0.5, mockTitle ?? 'DeFi Research Bounty');
    return { started: true, bountyId, demoMode: true };
  }
  const res = await fetch(`${BASE}/bounties/${bountyId}/start`, { method: 'POST' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getVerdict(bountyId: string) {
  const res = await fetch(`${BASE}/bounties/${bountyId}/verdict`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getStrategyStats() {
  const res = await fetch(`${BASE}/strategy-stats`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function replayBounty(bountyId: string) {
  const res = await fetch(`${BASE}/bounties/${bountyId}/replay`, { method: 'POST' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function devReset() {
  const res = await fetch(`${BASE}/dev/reset`, { method: 'POST' });
  return res.json();
}
