// Stubbed harness for plan-graph.js: runs the workflow body the way the Workflow tool
// does (async function with agent/parallel/log/phase/args in scope) with a canned lead,
// investigators, refuters and synthesizer. Proves the validation, the reduce, the
// three-outcome verify, the fake-edge post-pass, and that EVERY path - clean, partial,
// early exit - returns a GraphState that validates against the canonical schema. Not
// the models.
//   node tests/plan-graph.smoke.mjs plugins/harness/workflows/plan-graph.js
import { readFileSync } from 'node:fs'
import { validate } from './schema-check.mjs'
const src = readFileSync(process.argv[2], 'utf8').replace(/export const meta = \{[\s\S]*?\n\}\n/, '')
const SCHEMA = JSON.parse(readFileSync('plugins/harness/schemas/graph-state.schema.json', 'utf8'))
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
let failures = 0
const fail = (m) => { console.error('  FAIL:', m); failures++ }
const eq = (label, got, want) => { if (JSON.stringify(got) !== JSON.stringify(want)) fail(`${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`) }
// Every return value is a GraphState. A payload that fails the schema is a bug in the
// script, whatever else it got right.
const isState = (label, out) => { const errs = validate(SCHEMA, out); if (errs.length) fail(`${label}: not a valid GraphState:\n      ${errs.slice(0, 8).join('\n      ')}${errs.length > 8 ? `\n      (+${errs.length - 8} more)` : ''}`) }

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
    { id: 'P1', title: 'schema', commit: 'c1', files: ['server/src/db/models/arena/TradeOrder.ts'], dependsOn: [], owner: 'db', refs: ['F1'] },
    { id: 'P2', title: 'primitives', commit: 'c2', files: [`${HL}/exchangeApp.service.ts`], dependsOn: ['P1'], owner: 'arena' },                  // declared, no shared file -> unbacked
    { id: 'P3', title: 'wire the cycle', commit: 'c3', files: [`${TA}/ai-trading.service.ts`, `${HL}/exchangeApp.service.ts`], dependsOn: ['P2'], owner: 'arena' }, // declared AND shared
    { id: 'P4', title: 'followers', commit: 'c4', files: ['server/src/services/trading/copy-trading.service.ts', `./${TA}/ai-trading.service.ts`], dependsOn: [], owner: 'arena' }, // shares a file with P3, no edge
    { id: 'P5', title: 'tests', commit: 'c5', files: ['x.test.ts'], dependsOn: ['P9'], owner: 'test' },                                                       // dangling
  ],
  decisions: [{ question: 'percent basis?', recommendation: 'price move' }],
  risks: [{ risk: 'r', mitigation: 'm', refs: ['F2'] }],
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
// harnessRoot is relative to the repo root - tests/run-all.sh cds there before running.
const BASE = { requirements: 'make agent TP/SL real triggers', criteria: 'c', workingDir: '/x', harnessRoot: 'plugins/harness', integrationBranch: 'dev', maxVerify: 4 }

console.log('run 1: full diamond')
{
  const verdict = (l) => {
    if (l.startsWith('verify:F2:')) return { refuted: true, evidence: 'grep shows orderLong takes a trigger', confidence: 'high', correction: 'orderLong accepts a trigger param' }
    return { refuted: false, evidence: 'FOUND', confidence: 'high' }
  }
  const { out, logs, calls } = await run(BASE, { verdict })
  logs.forEach((l) => console.log('   ', l))
  isState('clean run', out)
  // the state envelope
  eq('version / graph / mode', [out.version, out.run.graph, out.run.mode], [1, 'plan-graph', 'existing'])
  eq('run carries where it ran', [out.run.workingDir, out.run.harnessRoot, out.run.integrationBranch, out.run.id], ['/x', 'plugins/harness', 'dev', ''])
  eq('brief: criteria split one per entry', out.brief, { requirements: 'make agent TP/SL real triggers', criteria: ['c'], constraints: [] })
  eq('greenfield + execute sections present and empty', [out.decisions, out.contract, out.artifacts, out.validations, out.repairs], [[], {}, {}, [], []])
  // lead validation
  eq('agentType allowlist', out.briefs.map((b) => b.agentType), ['harness:plan-investigator', 'harness:plan-investigator', 'harness:plan-investigator'])
  if (!logs.some((l) => l.includes('"treasury-architect" is not on the read-only allowlist'))) fail('non-read-only agentType must be logged and replaced')
  eq('overlap detected', out.lead.overlaps.map((o) => [o.a, o.b]), [['B2', 'B3']])
  eq('coverage lives on the brief', out.briefs.map((b) => b.coverage), ['read the entry path', 'read the fill pipeline', 'nothing in scope'])
  // tiering
  const lead = calls.find((c) => c.label === 'lead'); eq('lead is strong', [lead.agentType, lead.model], ['harness:code-architect', undefined])
  const synth = calls.find((c) => c.label === 'synthesize'); eq('synthesizer is strong', [synth.agentType, synth.model], ['harness:code-architect', undefined])
  if (calls.filter((c) => c.label.startsWith('investigate:')).some((c) => c.model !== 'sonnet')) fail('investigators must run on sonnet by default')
  if (calls.filter((c) => c.label.startsWith('verify:')).some((c) => c.agentType !== 'harness:claim-refuter' || c.model !== 'sonnet')) fail('refuters must be harness:claim-refuter on sonnet')
  // reduce
  eq('raw -> distinct', [out.run.counts.findingsRaw, out.run.counts.findings, out.run.counts.agreed], [7, 6, 1])
  const f1 = out.facts.find((f) => f.id === 'F1')
  eq('twin merged with agreement and stronger rating kept', [f1.agreedBy, f1.importance, f1.confidence], [['B1', 'B2'], 'critical', 'high'])
  if (!out.facts.find((f) => f.id === 'F4' && f.outOfScope)) fail('out-of-scope finding must be kept and flagged')
  // rank + cap
  eq('verified top 4 by importance/kind/agreement', out.facts.filter((f) => f.status !== 'past-cap').map((f) => f.id).sort(), ['F1', 'F2', 'F3', 'F4'])
  eq('past cap', out.facts.filter((f) => f.status === 'past-cap').map((f) => f.id).sort(), ['F5', 'F6'])
  // verify outcomes
  eq('counts', [out.run.counts.verified, out.run.counts.confirmed, out.run.counts.refuted, out.run.counts.unverified, out.run.counts.pastCap], [4, 3, 1, 0, 2])
  const f2 = out.facts.find((f) => f.id === 'F2'); eq('refuted carries the correction', [f2.status, f2.correction], ['refuted', 'orderLong accepts a trigger param'])
  if (!logs.some((l) => l.includes('refuted F2') && l.includes('orderLong accepts'))) fail('refutations must be logged with the correction')
  if (out.facts.some((f) => 'correction' in f && f.correction === undefined)) fail('no undefined-valued keys in the state - it must round-trip through JSON unchanged')
  // post-pass on phases
  eq('declared edges (dangling excluded)', out.run.counts.declaredEdges, 2)
  eq('shared-file edge added', out.sharedFileEdgesAdded.map((e) => [e.from, e.to]), [['P3', 'P4']])
  eq('unbacked declared edge reported, not deleted', out.unbackedEdges, [{ from: 'P1', to: 'P2' }])
  eq('dangling dependsOn reported', out.danglingDeps, [{ phase: 'P5', dependsOn: 'P9' }])
  eq('layers', out.layers, [['P1', 'P5'], ['P2'], ['P3'], ['P4']])
  if (!logs.some((l) => l.includes('not backed by a shared file') && l.includes('is a fake edge'))) fail('fake-edge report must name the rule')
  eq('phase refs kept, defaulted to [] when the synthesizer gave none', out.phases.map((p) => p.refs), [['F1'], [], [], [], []])
  if (out.phases.some((p) => 'uid' in p)) fail('uid is a code-internal handle and must not leak into the state')
  eq('risk refs', out.risks, [{ risk: 'r', mitigation: 'm', refs: ['F2'] }])
  eq('gaps surfaced', out.gaps, ['follower config source'])
  eq('human decisions (renamed from decisions)', out.humanDecisions, [{ question: 'percent basis?', recommendation: 'price move' }])
  eq('agent calls', out.run.counts.agentCalls, 1 + 3 + 4 + 1)
  if (out.run.partial) fail('partial should be false on a clean run')
  eq('no errors on a clean run', out.run.errors, [])
  if (out.plan !== 'PLAN') fail('plan missing')
  if (logs.some((l) => l.includes('do not reconcile'))) fail('reconcile warning fired')
}
console.log('run 2: dead investigator + dead verify layer')
{
  const { out, logs } = await run(BASE, { inv: { ...INV, B3: undefined }, deadVerify: true })
  isState('partial run', out)
  if (!out.run.partial) fail('partial must be true')
  eq('dead investigator has null coverage - missing, not empty', out.briefs.map((b) => b.coverage), ['read the entry path', 'read the fill pipeline', null])
  if (!logs.some((l) => l.includes('1 of 3 investigators returned nothing (B3)'))) fail('fan-in guard must name the dead investigator')
  if (!logs.some((l) => l.includes('the verify layer is dead - 0 of 4 refuters returned') && l.includes("agent type 'harness:claim-refuter' not found") && l.includes('resumeFromRunId'))) fail('dead verify layer must be named once with cause and recovery: ' + logs.filter((l) => l.startsWith('WARNING')).join(' | '))
  eq('all verified findings unverified, none killed', [out.run.counts.confirmed, out.run.counts.refuted, out.run.counts.unverified, out.run.counts.pastCap], [0, 0, 4, 2])
  if (logs.some((l) => l.includes('do not reconcile'))) fail('reconcile must hold with a dead verify layer')
}
console.log('run 3: guards and early exits - every early exit is still a GraphState')
{
  for (const [label, args, want] of [
    ['no requirements', { ...BASE, requirements: '' }, 'requirements is required'],
    ['no harnessRoot', { ...BASE, harnessRoot: '' }, 'harnessRoot is required'],
    ['maxBriefs out of range', { ...BASE, maxBriefs: 9 }, 'maxBriefs'],
    ['refutesToKill > votes', { ...BASE, votesPerFinding: 1, refutesToKill: 2 }, 'cannot exceed'],
  ]) {
    try { await run(args); fail(`${label}: should have thrown`) } catch (e) { if (!String(e.message).includes(want)) fail(`${label}: wrong error: ${e.message}`) }
  }
  const dead = await run(BASE, { lead: null })
  isState('dead lead', dead.out)
  eq('dead lead', [dead.out.run.partial, dead.out.run.errors, dead.out.run.counts.briefs, dead.out.plan], [true, ['lead returned no briefs'], 0, ''])
  const one = await run(BASE, { lead: { summary: 's', briefs: [LEAD.briefs[0]] } })
  isState('one brief', one.out)
  eq('one brief is not a graph', [one.out.run.partial, one.out.run.errors, one.out.briefs.length], [true, ['fewer than two briefs'], 1])
  const empty = await run(BASE, { inv: { B1: { findings: [], coverage: 'a' }, B2: { findings: [], coverage: 'b' }, B3: { findings: [], coverage: 'c' } } })
  isState('no findings', empty.out)
  eq('no findings', [empty.out.run.partial, empty.out.run.errors, empty.out.run.counts.findingsRaw, empty.out.facts], [true, ['no findings'], 0, []])
  const noSynth = await run(BASE, { synth: null })
  isState('dead synthesizer', noSynth.out)
  eq('dead synthesizer keeps the facts, names the error', [noSynth.out.run.partial, noSynth.out.run.errors, noSynth.out.facts.length, noSynth.out.plan], [true, ['synthesizer returned nothing'], 6, ''])
  const two = await run({ ...BASE, maxBriefs: 2 })
  eq('maxBriefs truncates', two.out.run.counts.briefs, 2)
  if (!two.logs.some((l) => l.includes('running the first 2'))) fail('truncation must be logged')
}
console.log('run 4: ids are the vocabulary - the code assigns them')
{
  const lead = { summary: 's', briefs: [{ ...LEAD.briefs[0], id: 'entry' }, { ...LEAD.briefs[1], id: 'entry' }, { ...LEAD.briefs[2], id: '' }] } // duplicate and empty ids from the lead
  const synth = { ...SYNTH, phases: [
    { id: 'alpha', title: 'a', commit: 'c', files: ['a.ts'], dependsOn: [], owner: 'x' },
    { id: 'beta', title: 'b', commit: 'c', files: ['b.ts'], dependsOn: ['alpha'], owner: 'x' },
    { id: 'gamma', title: 'g', commit: 'c', files: ['g.ts'], dependsOn: ['nope'], owner: 'x' },
  ] }
  const { out, logs } = await run(BASE, { lead, synth })
  isState('normalized ids', out)
  eq('brief ids are positional', out.briefs.map((b) => b.id), ['B1', 'B2', 'B3'])
  eq('phase ids are positional and dependsOn is remapped', out.phases.map((p) => [p.id, p.dependsOn]), [['P1', []], ['P2', ['P1']], ['P3', []]])
  eq('a dependsOn the remap cannot resolve is dangling, under the original name', out.danglingDeps, [{ phase: 'P3', dependsOn: 'nope' }])
  eq('edges use the new ids', out.edges, [{ from: 'P1', to: 'P2', reason: 'declared' }])
  if (!logs.some((l) => l.includes('renamed') && l.includes('alpha->P1'))) fail('id normalization must be logged: ' + logs.filter((l) => l.includes('renamed')).join(' | '))
}
console.log(failures ? `SMOKE: FAILED (${failures})` : 'SMOKE: PASS')
process.exitCode = failures ? 1 : 0
