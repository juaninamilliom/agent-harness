// Stubbed harness for plan-graph.js (v3): runs the workflow body the way the Workflow
// tool does (async function with agent/parallel/log/phase/args in scope) with a canned
// lead, investigators, refuters and synthesizer. Proves the validation, the reduce, the
// three-outcome verify and the fake-edge post-pass - not the models.
//   node workflows/plan-graph.smoke.mjs workflows/plan-graph.js
import { readFileSync } from 'node:fs'
const src = readFileSync(process.argv[2], 'utf8').replace(/export const meta = \{[\s\S]*?\n\}\n/, '')
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
let failures = 0
const fail = (m) => { console.error('  FAIL:', m); failures++ }
const eq = (label, got, want) => { if (JSON.stringify(got) !== JSON.stringify(want)) fail(`${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`) }

const HL = 'server/src/services/exchange'
const TA = 'server/src/services/arena'
const LEAD = {
  summary: 'three questions',
  briefs: [
    { id: 'B1', title: 'entry path', objective: 'q1', lens: 'state machine', boundaries: 'not fills', filesHint: [`${TA}/ai-trading.service.ts`] },
    { id: 'B2', title: 'fills', objective: 'q2', lens: 'money paths', boundaries: 'not entry', filesHint: [`${HL}/`], agentType: 'treasury-architect' }, // not read-only -> default
    { id: 'B3', title: 'tests', objective: 'q3', lens: 'test seams', boundaries: '', filesHint: [`${HL}/exchangeFillProcessor.ts`] },             // inside B2's ground
  ],
  notPartitioned: ['frontend - out of scope for the trial'],
}
const F = (claim, file, line, kind, importance, confidence = 'high') => ({ claim, file, line, quote: 'const x = 1', kind, importance, confidence })
const INV = {
  B1: {
    findings: [
      F('placeBracketOrder omits conversationId on the TradeOrder', `${HL}/exchangeApp.service.ts`, 2926, 'fact', 'critical'),
      F('openPosition calls orderLong with no trigger attached', `${TA}/ai-trading.service.ts`, 2554, 'fact', 'high'),
      F('attach triggers after the fill with placeTakeProfit', `${HL}/exchangeApp.service.ts`, 2609, 'recommendation', 'high'),
    ],
    outOfScope: [F('resolveSyncWindow skips wallets idle more than seven days', `${HL}/exchangeCron.service.ts`, 74, 'risk', 'critical')],
    coverage: 'read the entry path',
  },
  B2: {
    findings: [
      F('placeBracketOrder omits the conversationId field on the TradeOrder row', `./${HL}/exchangeApp.service.ts`, 2928, 'fact', 'high', 'medium'), // twin of B1's first
      F('processExchangeFill resolves the order by cloid', `${HL}/exchangeFillProcessor.ts`, 48, 'fact', 'medium'),
      F('trigger rows expire after thirty seconds', `${HL}/exchangeCron.service.ts`, 118, 'fact', 'low'),
    ],
    coverage: 'read the fill pipeline',
  },
  B3: { findings: [], coverage: 'nothing in scope' },
}
const SYNTH = {
  plan: 'PLAN',
  phases: [
    { id: 'P1', title: 'schema', commit: 'c1', files: ['server/src/db/models/arena/TradeOrder.ts'], dependsOn: [], owner: 'db' },
    { id: 'P2', title: 'primitives', commit: 'c2', files: [`${HL}/exchangeApp.service.ts`], dependsOn: ['P1'], owner: 'trading-arena' },                  // declared, no shared file -> unbacked
    { id: 'P3', title: 'wire the cycle', commit: 'c3', files: [`${TA}/ai-trading.service.ts`, `${HL}/exchangeApp.service.ts`], dependsOn: ['P2'], owner: 'trading-arena' }, // declared AND shared
    { id: 'P4', title: 'followers', commit: 'c4', files: ['server/src/services/trading/trading-copy-trading.service.ts', `./${TA}/ai-trading.service.ts`], dependsOn: [], owner: 'trading-arena' }, // shares a file with P3, no edge
    { id: 'P5', title: 'tests', commit: 'c5', files: ['x.test.ts'], dependsOn: ['P9'], owner: 'test' },                                                       // dangling
  ],
  decisions: [{ question: 'percent basis?', recommendation: 'price move' }],
  risks: [{ risk: 'r', mitigation: 'm' }],
  gaps: ['follower config source'],
}

async function run(args, { lead = LEAD, inv = INV, verdict = () => ({ refuted: false, evidence: 'FOUND', confidence: 'high' }), synth = SYNTH, deadVerify = false } = {}) {
  const logs = [], calls = []
  const agent = async (prompt, opts) => {
    const l = opts.label
    calls.push({ label: l, agentType: opts.agentType, model: opts.model })
    if (l === 'lead') return lead
    if (l.startsWith('investigate:')) return inv[l.slice(12)] === undefined ? null : inv[l.slice(12)]
    if (l.startsWith('verify:')) {
      if (deadVerify) throw new Error(`agent type '${opts.agentType}' not found`)
      return verdict(l)
    }
    if (l === 'synthesize') return synth
    throw new Error('unexpected ' + l)
  }
  const parallel = (thunks) => Promise.all(thunks.map((t) => t().catch(() => null)))
  const out = await new AsyncFunction('agent', 'parallel', 'log', 'phase', 'args', src)(agent, parallel, (m) => logs.push(m), () => {}, args)
  return { out, logs, calls }
}
const BASE = { requirements: 'make agent TP/SL real triggers', criteria: 'c', workingDir: '/x', maxVerify: 4 }

console.log('run 1: full diamond')
{
  const verdict = (l) => {
    if (l.startsWith('verify:F2:')) return { refuted: true, evidence: 'grep shows orderLong takes a trigger', confidence: 'high', correction: 'orderLong accepts a trigger param' }
    return { refuted: false, evidence: 'FOUND', confidence: 'high' }
  }
  const { out, logs, calls } = await run(BASE, { verdict })
  logs.forEach((l) => console.log('   ', l))
  // lead validation
  eq('agentType allowlist', out.briefs.map((b) => b.agentType), ['plan-investigator', 'plan-investigator', 'plan-investigator'])
  if (!logs.some((l) => l.includes('"treasury-architect" is not on the read-only allowlist'))) fail('non-read-only agentType must be logged and replaced')
  eq('overlap detected', out.overlaps.map((o) => [o.a, o.b]), [['B2', 'B3']])
  // tiering
  const lead = calls.find((c) => c.label === 'lead'); eq('lead is strong', [lead.agentType, lead.model], ['code-architect', undefined])
  const synth = calls.find((c) => c.label === 'synthesize'); eq('synthesizer is strong', [synth.agentType, synth.model], ['code-architect', undefined])
  if (calls.filter((c) => c.label.startsWith('investigate:')).some((c) => c.model !== 'sonnet')) fail('investigators must run on sonnet by default')
  if (calls.filter((c) => c.label.startsWith('verify:')).some((c) => c.agentType !== 'claim-refuter' || c.model !== 'sonnet')) fail('refuters must be claim-refuter on sonnet')
  // reduce
  eq('raw -> distinct', [out.counts.findingsRaw, out.counts.findings, out.counts.agreed], [7, 6, 1])
  const f1 = out.findings.find((f) => f.id === 'F1')
  eq('twin merged with agreement and stronger rating kept', [f1.agreedBy, f1.importance, f1.confidence], [['B1', 'B2'], 'critical', 'high'])
  if (!out.findings.find((f) => f.id === 'F4' && f.outOfScope)) fail('out-of-scope finding must be kept and flagged')
  // rank + cap
  eq('verified top 4 by importance/kind/agreement', out.findings.filter((f) => f.status !== 'past-cap').map((f) => f.id).sort(), ['F1', 'F2', 'F3', 'F4'])
  eq('past cap', out.findings.filter((f) => f.status === 'past-cap').map((f) => f.id).sort(), ['F5', 'F6'])
  // verify outcomes
  eq('counts', [out.counts.verified, out.counts.confirmed, out.counts.refuted, out.counts.unverified, out.counts.pastCap], [4, 3, 1, 0, 2])
  const f2 = out.findings.find((f) => f.id === 'F2'); eq('refuted carries the correction', [f2.status, f2.correction], ['refuted', 'orderLong accepts a trigger param'])
  if (!logs.some((l) => l.includes('refuted F2') && l.includes('orderLong accepts'))) fail('refutations must be logged with the correction')
  // post-pass on phases
  eq('declared edges (dangling excluded)', out.counts.declaredEdges, 2)
  eq('shared-file edge added', out.sharedFileEdgesAdded.map((e) => [e.from, e.to]), [['P3', 'P4']])
  eq('unbacked declared edge reported, not deleted', out.unbackedEdges, [{ from: 'P1', to: 'P2' }])
  eq('dangling dependsOn reported', out.danglingDeps, [{ phase: 'P5', dependsOn: 'P9' }])
  eq('layers', out.layers, [['P1', 'P5'], ['P2'], ['P3'], ['P4']])
  if (!logs.some((l) => l.includes('not backed by a shared file') && l.includes('is a fake edge'))) fail('fake-edge report must name the rule')
  eq('gaps surfaced', out.gaps, ['follower config source'])
  eq('agent calls', out.counts.agentCalls, 1 + 3 + 4 + 1)
  if (out.partial) fail('partial should be false on a clean run')
  if (out.plan !== 'PLAN') fail('plan missing')
  if (logs.some((l) => l.includes('do not reconcile'))) fail('reconcile warning fired')
}
console.log('run 2: dead investigator + dead verify layer')
{
  const { out, logs } = await run(BASE, { inv: { ...INV, B3: undefined }, deadVerify: true })
  if (!out.partial) fail('partial must be true')
  if (!logs.some((l) => l.includes('1 of 3 investigators returned nothing (B3)'))) fail('fan-in guard must name the dead investigator')
  if (!logs.some((l) => l.includes('the verify layer is dead - 0 of 4 refuters returned') && l.includes("agent type 'claim-refuter' not found") && l.includes('resumeFromRunId'))) fail('dead verify layer must be named once with cause and recovery: ' + logs.filter((l) => l.startsWith('WARNING')).join(' | '))
  eq('all verified findings unverified, none killed', [out.counts.confirmed, out.counts.refuted, out.counts.unverified, out.counts.pastCap], [0, 0, 4, 2])
  if (logs.some((l) => l.includes('do not reconcile'))) fail('reconcile must hold with a dead verify layer')
}
console.log('run 3: guards')
{
  for (const [label, args, want] of [
    ['no requirements', { ...BASE, requirements: '' }, 'requirements is required'],
    ['maxBriefs out of range', { ...BASE, maxBriefs: 9 }, 'maxBriefs'],
    ['refutesToKill > votes', { ...BASE, votesPerFinding: 1, refutesToKill: 2 }, 'cannot exceed'],
  ]) {
    try { await run(args); fail(`${label}: should have thrown`) } catch (e) { if (!String(e.message).includes(want)) fail(`${label}: wrong error: ${e.message}`) }
  }
  const dead = await run(BASE, { lead: null })
  eq('dead lead', [dead.out.partial, dead.out.error], [true, 'lead returned no briefs'])
  const one = await run(BASE, { lead: { summary: 's', briefs: [LEAD.briefs[0]] } })
  eq('one brief is not a graph', [one.out.partial, one.out.error], [true, 'fewer than two briefs'])
  const six = await run({ ...BASE, maxBriefs: 2 })
  eq('maxBriefs truncates', six.out.counts.briefs, 2)
  if (!six.logs.some((l) => l.includes('running the first 2'))) fail('truncation must be logged')
}
console.log(failures ? `SMOKE: FAILED (${failures})` : 'SMOKE: PASS')
process.exitCode = failures ? 1 : 0
