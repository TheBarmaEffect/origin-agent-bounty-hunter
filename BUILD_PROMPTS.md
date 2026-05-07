# Origin Agent Bounty Hunter — Build Continuation Prompts

> These prompts pick up where the initial build left off.
> Execute them sequentially. Each must pass its tests before starting the next.
> All require real credentials (AWS + CDP). See HANDOFF.md for details.

---

## Prerequisites Before Starting

```bash
# Fill in your real credentials in .env:
CDP_API_KEY_ID=           # From Coinbase Developer Platform
CDP_API_KEY_SECRET=       # From CDP
CDP_WALLET_SECRET=        # From CDP wallet
VERDICT_PRIVATE_KEY=      # Funded Base Sepolia wallet private key
AWS_REGION=us-east-1      # AWS region with Bedrock access
BEDROCK_REGION=us-east-1  # Must have Claude Sonnet model access
```

Get Base Sepolia test ETH: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet  
Get test USDC on Base Sepolia: https://faucet.circle.com  
CDP API keys: https://portal.cdp.coinbase.com  
AWS Bedrock access: https://console.aws.amazon.com/bedrock/home#/model-access  

---

## PROMPT 1 — x402 Paid Endpoint (Start Here)

Build a working x402-gated data endpoint for Origin Agent Bounty Hunter.

STACK:
- AWS Lambda (Node.js 20)
- Amazon CloudFront distribution
- Lambda@Edge for payment verification
- Coinbase CDP x402 Facilitator on Base Sepolia
- S3 bucket for data storage

WHAT TO BUILD:
A paid data endpoint that returns DeFi protocol data only after 
verifying a valid x402 USDC payment on Base Sepolia.

EXACT BEHAVIOR:
1. Agent sends GET /data/defi-protocols
2. Lambda@Edge intercepts, checks for x-payment header
3. If no header: return HTTP 402 with body:
   {
     "x402Version": 1,
     "accepts": [{
       "scheme": "exact",
       "network": "base-sepolia",
       "maxAmountRequired": "1000",
       "resource": "/data/defi-protocols",
       "description": "DeFi protocol research data",
       "mimeType": "application/json",
       "payTo": "<YOUR_WALLET_ADDRESS>",
       "maxTimeoutSeconds": 60,
       "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
       "extra": { "name": "USDC", "version": "2" }
     }]
   }
4. If valid payment header present: call CDP Facilitator verify endpoint
5. If verified: return actual DeFi data from S3
6. If invalid: return 402 again

DATA TO SERVE (store this in S3 as defi-protocols.json):
[
  {"protocol": "Aerodrome", "tvl": 890000000, "volume24h": 45000000, "apy": 12.4},
  {"protocol": "Uniswap V3", "tvl": 3200000000, "volume24h": 890000000, "apy": 8.1},
  {"protocol": "Curve", "tvl": 1800000000, "volume24h": 234000000, "apy": 6.7},
  {"protocol": "Aave V3", "tvl": 6700000000, "volume24h": 123000000, "apy": 4.2},
  {"protocol": "Compound", "tvl": 890000000, "volume24h": 45000000, "apy": 3.8}
]

ENVIRONMENT VARIABLES NEEDED:
- CDP_API_KEY_NAME
- CDP_API_KEY_PRIVATE_KEY  
- FACILITATOR_URL=https://x402.org/facilitator
- WALLET_ADDRESS
- S3_BUCKET_NAME

FALLBACK MODE:
Add env var MOCK_X402=true that skips real payment verification 
and returns data directly. This is for local development only.

TESTS TO WRITE AND PASS BEFORE DONE:
1. GET /data/defi-protocols with no header → assert 402 response 
   with correct payment spec shape
2. GET /data/defi-protocols with invalid payment → assert 402 again
3. GET /data/defi-protocols with MOCK_X402=true → assert 200 with 
   data array of 5 protocols
4. Unit test for payment spec structure validation
5. Unit test for S3 data fetch

PREVIEW STEPS:
1. Deploy Lambda with MOCK_X402=true
2. Hit endpoint with curl, confirm 200 and data
3. Switch MOCK_X402=false
4. Hit endpoint with curl, confirm 402 with payment spec
5. Show me the CloudFront URL and the 402 response body

Do not move on until all 5 tests pass and preview steps confirm 
real 402 response from CloudFront URL.

---

## PROMPT 2 — Agent Wallet + x402 Payment Client

Build the agent-side x402 payment client for Origin Agent Bounty Hunter.

STACK:
- Coinbase AgentKit (latest)
- Base Sepolia testnet
- Node.js / TypeScript
- CDP Wallet with test USDC

WHAT TO BUILD:
A reusable payment client that any solver agent can import to 
autonomously pay x402 endpoints and get data back.

THE CLIENT MUST DO THIS FLOW:
1. Receive a URL to fetch
2. Send GET request
3. If 402 received: parse payment requirements from response body
4. Sign payment authorization using AgentKit EIP-3009 wallet
5. Retry GET with x-payment header containing signed authorization
6. Call CDP Facilitator to verify
7. Return the data to the calling agent
8. Store payment receipt: { url, amount, txHash, timestamp, agentId }

EXACT INTERFACE:
class OriginPaymentClient {
  constructor(agentId: string, budgetUsdc: number)
  
  async fetch(url: string): Promise<{
    data: any,
    receipt: PaymentReceipt,
    amountPaid: number,
    remainingBudget: number
  }>
  
  async getBudgetRemaining(): Promise<number>
  async getSpendHistory(): Promise<PaymentReceipt[]>
}

WALLET SETUP:
- Create CDP wallet on Base Sepolia
- Fund with test USDC from Base Sepolia faucet
- Store wallet seed in environment variable AGENT_WALLET_SEED
- Each agent gets its own wallet instance with separate budget tracking

BUDGET ENFORCEMENT:
- If payment required > remainingBudget: throw BudgetExceededError
- Log every spend attempt to DynamoDB table: OriginAgentSpend
  PK: agentId, SK: timestamp
  Fields: url, amountPaid, success, receiptHash

ENVIRONMENT VARIABLES:
- CDP_API_KEY_NAME
- CDP_API_KEY_PRIVATE_KEY
- AGENT_WALLET_SEED
- FACILITATOR_URL=https://x402.org/facilitator
- DYNAMODB_TABLE=OriginAgentSpend
- AWS_REGION

TESTS TO WRITE AND PASS:
1. Client initializes with correct budget
2. fetch() against MOCK_X402=true endpoint returns data and receipt
3. fetch() against real 402 endpoint: assert payment header is sent
4. Budget tracking: after spend, remainingBudget decreases correctly
5. BudgetExceededError thrown when payment > remaining budget
6. DynamoDB receipt write confirmed after successful payment
7. getSpendHistory() returns correct records from DynamoDB

PREVIEW STEPS:
1. Initialize client with $0.10 budget
2. Call fetch() against the CloudFront endpoint from Prompt 1
3. Show me: the 402 response, the signed payment header, 
   the verified response, and the DynamoDB receipt entry
4. Call getBudgetRemaining() and confirm it decreased
5. Show the Base Sepolia transaction hash on basescan.org

Do not proceed until a real x402 payment completes end-to-end 
and the transaction is visible on Base Sepolia testnet explorer.

---

## PROMPT 3 — The Five Solver Agents + Trace Engine

Build the five constrained solver agents for Origin Agent Bounty Hunter.

STACK:
- Amazon Bedrock AgentCore Runtime
- Strands SDK (Python)
- OriginPaymentClient from Prompt 2
- DynamoDB for trace storage

SHARED AGENT INTERFACE:
Every agent must implement this exact interface:

class SolverAgent:
  agentId: str
  algorithm: Literal["BFS","DFS","ASTAR","MONTECARLO","GREEDY"]
  budget: float
  
  async def solve(bounty: Bounty) -> AgentSubmission:
    # returns answer + full trace

  def emit_trace_event(event: TraceEvent) -> None:
    # writes to DynamoDB OriginRaceEvents table

TRACE EVENT SCHEMA (emit this for every meaningful step):
{
  "eventId": "uuid",
  "bountyId": "string",
  "agentId": "string", 
  "algorithm": "string",
  "timestamp": "ISO8601",
  "eventType": one of [
    "AGENT_STARTED", "NODE_EVALUATED", "PAYMENT_MADE",
    "PATH_COMMITTED", "SAMPLE_TAKEN", "ANSWER_SUBMITTED"
  ],
  "nodeId": "string",
  "depth": number,
  "parentNodeId": "string or null",
  "score": number,
  "heuristicVersionHash": "string or null",
  "x402PaymentRef": "string or null",
  "payload": "any relevant data"
}

BUILD EACH AGENT:

AGENT 1 - Scout (BFS):
- Maintains explicit FIFO queue (list, pop from front)
- MUST explore minimum 3 distinct nodes at depth=1 before 
  any node can go to depth=2
- Emits NODE_EVALUATED for every node with depth value
- Calls x402 endpoint to get data, emits PAYMENT_MADE
- Violation: if depth>1 node appears before 3 depth=1 nodes 
  in trace → mark as CONSTRAINT_VIOLATION in trace

AGENT 2 - Drill (DFS):
- Maintains explicit LIFO stack (list, pop from end)
- MUST commit to one path until depth=3 before backtracking
- Records active_path as array in every trace event
- Violation: if stack shows breadth-first pattern → CONSTRAINT_VIOLATION

AGENT 3 - Compass (A*):
- Declares heuristic at t=0: 
  H(protocol) = (volume24h / tvl) * 100
- Stores heuristic_hash = sha256(heuristic_string) at start
- Ranks all candidates by f(n) = g(n) + h(n)
- g(n) = steps taken, h(n) = heuristic score
- heuristic_hash must be identical in every trace event
- Violation: if heuristic_hash changes mid-run → CONSTRAINT_VIOLATION

AGENT 4 - Dice (Monte Carlo):
- Generates random seed, logs it at start
- Runs minimum 5 random samples from data set
- Each sample hits a different protocol endpoint
- Reports confidence score and variance in final answer
- Violation: if sample_count < 5 → CONSTRAINT_VIOLATION

AGENT 5 - Dash (Greedy):
- At each step, picks highest-score immediate option
- Records every choice in trace
- NEVER revisits a node (track visited set)
- Submits as soon as first acceptable answer found
- Violation: if any node_id appears twice in trace → CONSTRAINT_VIOLATION

BOUNTY TYPE FOR DEMO:
"Find the top 3 DeFi protocols by risk-adjusted yield 
(volume/TVL ratio) in the last 24 hours. Explain your methodology."

Each agent fetches data from the x402 endpoint built in Prompt 1.
Each agent must actually call the payment client and spend budget.

DYNAMODB TABLES TO WRITE:
- OriginRaceEvents: PK=bountyId, SK=timestamp#agentId#eventId
- OriginSubmissions: PK=bountyId, SK=agentId
  Fields: answer, traceEventCount, amountSpent, 
          submittedAt, constraintViolations

TESTS TO WRITE AND PASS:
1. Scout: trace contains 3+ depth=1 nodes before any depth=2 node
2. Drill: trace shows active_path growing to depth 3 before branch
3. Compass: heuristic_hash identical across all trace events
4. Dice: sample_count >= 5 in submission record
5. Dash: no node_id appears twice in trace
6. All 5 agents: PAYMENT_MADE event exists in trace (real x402 call)
7. All 5 agents: submission written to DynamoDB
8. CONSTRAINT_VIOLATION test: manually break Scout's BFS rule, 
   confirm violation is recorded in trace

PREVIEW STEPS:
1. Run all 5 agents against the same bounty simultaneously
2. Show me DynamoDB OriginRaceEvents table with events from all 5 agents
3. Show me DynamoDB OriginSubmissions table with all 5 answers
4. Show me one trace that has a real PAYMENT_MADE event with tx ref
5. Trigger the constraint violation test for Scout, show the 
   CONSTRAINT_VIOLATION event in DynamoDB

Do not proceed until all 8 tests pass and all 5 agents have 
real trace events in DynamoDB.

---

## PROMPT 4 — Optimus: Classifier + Auditor + Evaluator + Payer

Build Optimus, the superior agent for Origin Agent Bounty Hunter.

STACK:
- Amazon Bedrock (Claude Sonnet via boto3)
- Python
- DynamoDB (read OriginRaceEvents, write OriginVerdicts)
- S3 (write receipt bundles)
- Lambda (trigger Base verdict hash publish)
- OriginPaymentClient for winner payout

OPTIMUS HAS 6 SEQUENTIAL MODULES. BUILD THEM IN ORDER:

MODULE 1 - Problem Classifier:
Input: bounty prompt string
Output: { 
  problemType: "breadth_discovery"|"depth_analysis"|
               "heuristic_structured"|"probabilistic"|"speed_critical",
  predictedWinner: agentId,
  confidence: float,
  reasoning: string
}
Use Bedrock Claude Sonnet with this exact system prompt:
"You are a problem classifier for an algorithmic agent competition. 
Classify the problem type and predict which search algorithm will 
perform best. Return only valid JSON matching the output schema."

Store prediction in DynamoDB OriginBounties table.

MODULE 2 - Deterministic Constraint Auditor:
Input: agentId, algorithm, traceEvents (from DynamoDB)
Output: { passed: bool, violations: string[], auditScore: 0-100 }

Run these HARD assertions (no LLM, pure code):

For BFS/Scout:
  depth1_nodes = [e for e in trace if e.depth == 1]
  depth2_nodes = [e for e in trace if e.depth == 2]
  if depth2_nodes exist:
    first_depth2_index = index of first depth2 event
    depth1_before = count of depth1 events before first_depth2_index
    assert depth1_before >= 3, "BFS breadth floor violated"
  assert queue_discipline == "FIFO" based on node ordering

For DFS/Drill:
  assert max(active_path_lengths) >= 3 before any branch
  assert no breadth pattern (multiple depth=1 nodes explored 
  before going deep)

For A*/Compass:
  hashes = [e.heuristicVersionHash for e in trace]
  assert len(set(hashes)) == 1, "Heuristic changed mid-run"
  assert hashes[0] is not None

For Monte Carlo/Dice:
  samples = [e for e in trace if e.eventType == "SAMPLE_TAKEN"]
  assert len(samples) >= 5, "Minimum samples not reached"

For Greedy/Dash:
  node_ids = [e.nodeId for e in trace if e.nodeId]
  assert len(node_ids) == len(set(node_ids)), "Node revisited"

If assertion fails: record violation string, set passed=False
This must produce visible red X in UI. Build one intentional 
failure into test data.

MODULE 3 - Quality Evaluator:
Input: agentId, submission answer, bounty prompt
Use Bedrock Claude Sonnet to score:
System: "You are a quality judge for autonomous agent work. 
Score the submission on these dimensions. Return only JSON."
Score these dimensions (0-100 each):
- correctness: Does it answer the bounty correctly?
- evidence: Are claims backed by data from the trace?
- reasoning: Is the methodology explained clearly?
- novel_discovery: Did it find anything non-obvious?

Final quality score = weighted average:
  correctness*0.40 + evidence*0.25 + reasoning*0.25 + novel*0.10

MODULE 4 - Final Scorer:
Combined score formula:
  if constraint_audit.passed:
    final = (quality_score * 0.70) + (audit_score * 0.20) + 
            (speed_score * 0.10)
  else:
    final = quality_score * 0.30  # heavy penalty for violations

speed_score = 100 * (1 - (agent_elapsed_ms / max_elapsed_ms))

Pick winner = agent with highest final score.

MODULE 5 - Verdict Writer:
Use Bedrock Claude Sonnet:
"Write a 3-sentence verdict explaining why {winner} won this 
bounty, what {second_place} missed, and what this reveals about 
{winner.algorithm} for {problemType} tasks."

Also check: did Optimus predict the correct winner?
If wrong: append "Optimus predicted {predictedWinner} but 
{actualWinner} won. Strategy memory updated."

MODULE 6 - Payment Controller + Receipt Writer:
1. Pay winner via OriginPaymentClient (real x402 payment to 
   winning agent's wallet)
2. Write full receipt to S3:
   {
     bountyId, prompt, problemType, prediction, 
     agentScores: [{agentId, auditResult, qualityScore, finalScore}],
     winner, verdict, payoutAmount, payoutTxHash,
     timestamp
   }
3. Hash the receipt: sha256(JSON.stringify(receipt))
4. Call Lambda to publish hash to Base Sepolia VerdictRegistry contract
5. Write to DynamoDB OriginVerdicts:
   { bountyId, winner, finalScores, verdictText, 
     receiptS3Uri, verdictHash, baseTxHash }

STRATEGY MEMORY UPDATE:
After every verdict, update DynamoDB OriginStrategyMemory:
  PK: problemType, SK: algorithm
  Increment: totalRuns, wins (if winner), totalQualityScore
  Compute: winRate = wins/totalRuns

TESTS TO WRITE AND PASS:
1. Classifier returns valid problemType for sample bounty prompt
2. BFS auditor: pass valid Scout trace → passed=true, 0 violations
3. BFS auditor: fail invalid Scout trace → passed=false, 
   violation string contains "breadth floor"
4. A* auditor: changed heuristic hash → violation detected
5. Quality evaluator: returns scores summing correctly
6. Final scorer: violated agent scores lower than compliant agent
7. Receipt written to S3 and fetchable
8. VerdictHash computed and stored in DynamoDB
9. StrategyMemory updated after verdict
10. Winner payment: real x402 payout transaction exists

PREVIEW STEPS:
1. Run Optimus against the 5 agent submissions from Prompt 3
2. Show me the full verdict in terminal
3. Show me the S3 receipt JSON
4. Show me DynamoDB OriginVerdicts entry
5. Show me the strategy memory update in OriginStrategyMemory
6. Show me the winner payout transaction on Base Sepolia explorer
7. Trigger the intentional constraint violation and show 
   red X audit result

Do not proceed until all 10 tests pass and a real winner 
payout transaction is visible on Base Sepolia.

---

## PROMPT 5 — Frontend Dashboard + Replay Mode

Build the Origin Agent Bounty Hunter live race dashboard.

STACK:
- React 18 + TypeScript
- Tailwind CSS
- Server-Sent Events (SSE) for live updates
- Recharts for leaderboard visualization
- S3 + CloudFront hosting
- API Gateway + Lambda for backend events

DESIGN PHILOSOPHY:
This is a cinematic live arena, not an admin panel. Dark theme. 
Every state change animates. Judges should feel like they're 
watching a race, not reading a log.

Color scheme:
- Background: #0D1117
- Scout/BFS: #3B82F6 (blue)
- Drill/DFS: #EF4444 (red)  
- Compass/A*: #F59E0B (amber)
- Dice/Monte Carlo: #8B5CF6 (purple)
- Dash/Greedy: #10B981 (green)
- Success: #22C55E
- Violation: #EF4444
- Optimus: #F7931A (orange)

BUILD THESE PANELS:

PANEL 1 - Bounty Input (top):
- Text area: "Describe your bounty"
- Number input: "Prize (USDC)" 
- Dropdown: bounty type
- Big button: "POST BOUNTY" 
- Below button: x402 payment status strip showing:
  "Awaiting payment" → "402 Received" → "Payment signed" → 
  "Verified on Base" → "Race started"
- Animate each state transition with pulse effect

PANEL 2 - Agent Cards (5 cards in a row):
Each card shows:
- Agent name (Scout, Drill, Compass, Dice, Dash) 
- Algorithm badge (BFS, DFS, A*, MC, GREEDY)
- Status pill: WAITING → RUNNING → SUBMITTED → AUDITED → SCORED
- Progress bar (fills as trace events arrive)
- Spend counter: "$0.0000 spent" updating in real time
- Submission timer (counting up from race start)
- When SUBMITTED: answer preview truncated to 2 lines
- When AUDITED: green checkmarks or red X per constraint
- When SCORED: final score number with rank badge

PANEL 3 - Live Leaderboard (center):
- Horizontal bar chart (recharts)
- Updates after each submission and again after scoring
- Bars colored by agent color
- Animate bar width changes with 500ms transition
- Show two states: "Submission order" and "Final scores"
- Leaderboard reorders between these two states live

PANEL 4 - x402 Payment Flow (right sidebar):
Running list of payment events:
- Each event: agent icon, arrow, endpoint name, amount, status
- Color coded: pending=gray, confirmed=green, failed=red
- Show Base Sepolia tx hash as clickable link to basescan.org
- Running total: "Total x402 payments: $X.XXXX"

PANEL 5 - Trace Viewer (expandable, per agent):
Click any agent card to expand trace:
- Timeline of trace events (NODE_EVALUATED, PAYMENT_MADE, etc.)
- For BFS: tree diagram showing queue expansion
- For A*: show heuristic score alongside each node
- Constraint check results with pass/fail badges
- Each payment event links to basescan

PANEL 6 - Optimus Verdict (appears after race):
- "OPTIMUS IS EVALUATING..." with animated thinking indicator
- Reveals winner with confetti animation
- Shows prediction vs actual (highlight if Optimus was wrong)
- 3-sentence verdict text typed out character by character
- Score breakdown table: all 5 agents, all dimensions
- Winner gets gold border and "WINNER" badge
- Payout animation: wallet icon with USDC flowing to winner

PANEL 7 - Receipt Panel (bottom):
- S3 receipt URI (clickable)
- Verdict hash (sha256, truncated with copy button)
- Base Sepolia tx hash (clickable → basescan)
- Payout amount and recipient wallet
- "Replay this run" button

REPLAY MODE:
When replay button clicked OR when LIVE_DEMO=false:
- Load saved event stream from DynamoDB OriginRaceEvents
- Replay all events with original timestamps compressed to 
  real-time playback
- Everything looks identical to live
- Small "REPLAY" badge in top right corner
- This is your insurance if live demo breaks on stage

SSE EVENTS TO CONSUME:
Connect to /api/race/{bountyId}/stream
Handle all event types from the spec
On each event: update relevant component state

DEMO BOUNTY (hardcode as quick-fill button):
Button: "Load Demo Bounty"
Fills: "Find the top 3 DeFi protocols by risk-adjusted yield 
in the last 24 hours. Explain your reasoning."
Prize: 2 USDC

TESTS TO WRITE AND PASS:
1. Bounty form submits and shows 402 payment flow
2. All 5 agent cards render and update state on SSE events
3. Leaderboard animates correctly on score updates
4. Trace viewer shows correct events per agent
5. Constraint violation shows red X on agent card
6. Optimus verdict panel appears only after WINNER_SELECTED event
7. Receipt panel shows real S3 URI and tx hash
8. Replay mode loads saved events and plays them back correctly
9. All Base Sepolia tx hashes are real clickable links
10. Mobile responsive (judges may look on phones)

PREVIEW STEPS:
1. Run with LIVE_DEMO=false and replay saved events from Prompt 3
2. Walk me through full race from bounty post to receipt
3. Click the basescan link and confirm transaction is real
4. Click replay and confirm it looks identical to live
5. Show me on mobile viewport (375px width)
6. Deploy to S3 + CloudFront and give me the public URL

Do not finish until the public CloudFront URL loads the 
dashboard and replay mode runs the full race end to end.

---

## Notes on Execution

- Start each session by pasting the HANDOFF.md as context
- Do not skip prompts — each builds on the previous
- MOCK_X402=true lets you test Prompt 1-3 logic without real funds
- Real transactions are required before Prompt 4's acceptance criteria pass
- The frontend (Prompt 5) can be partially built without real data using 
  the replay fixture already in data/replays/
