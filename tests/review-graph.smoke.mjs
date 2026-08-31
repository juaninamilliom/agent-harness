// Stubbed harness: run review-graph.js the way the Workflow tool does (body wrapped in an
// async function with agent/parallel/log/phase/args in scope), with lenses and skeptics
// replaced by canned results. Proves the reduce, not the models.
import { readFileSync } from 'node:fs'
const src = readFileSync(process.argv[2], 'utf8').replace(/export const meta = \{[\s\S]*?\n\}\n/, '')
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const logs = []
const log = (m) => logs.push(m)
const phase = () => {}
const parallel = (thunks) => Promise.all(thunks.map((t) => t().catch(() => null)))
const args = { branch: 'test', workingDir: '/x', changedFiles: ['src/services/wallet.service.ts', 'src/db/repositories/wallet.repository.ts'], maxAgents: 15 }
// Lens results: 2 in-scope (one duplicated across lenses), 1 OUT of scope (the
// wrong-checkout case), 1 with a ./ prefix that must still match, 1 near-miss path
// that must NOT match.
const lensFindings = {
  'lens:general':  [{ file: 'src/services/wallet.service.ts', line: 259, severity: 'critical', claim: 'c1', fix: 'f' },
                    { file: 'src/__tests__/services/exchange/exchangeSigner.test.ts', line: 96, severity: 'warning', claim: 'oos', fix: 'f' }],
  'lens:security': [{ file: './src/services/wallet.service.ts', line: 259, severity: 'critical', claim: 'c1 again', fix: 'f' },
                    { file: 'xsrc/db/repositories/wallet.repository.ts', line: 5, severity: 'warning', claim: 'near-miss', fix: 'f' }],
  'lens:tests':    [{ file: 'server/src/db/repositories/wallet.repository.ts', line: 345, severity: 'warning', claim: 'w1', fix: 'f' }],
}
const agent = async (prompt, opts) => {
  const l = opts.label
  if (l.startsWith('lens:')) return { findings: lensFindings[l] || [] }
  if (l.startsWith('verify:')) return { refuted: false, evidence: 'stub', moneyScope: false }
  if (l === 'synthesize') return 'REPORT'
  throw new Error('unexpected ' + l)
}
const out = await new AsyncFunction('agent', 'parallel', 'log', 'phase', 'args', src)(agent, parallel, log, phase, args)
const fail = (m) => { console.error('FAIL:', m); process.exitCode = 1 }
console.log('counts:', JSON.stringify(out.counts))
console.log('outOfScope:', out.outOfScope.map((f) => `${f.file}:${f.line}`).join(', '))
console.log('logs:'); logs.forEach((l) => console.log('  ', l))
if (out.counts.deduped !== 4) fail(`expected 4 deduped (dup merged), got ${out.counts.deduped}`)
if (out.counts.inScope !== 2) fail(`expected 2 in scope, got ${out.counts.inScope}`)
if (out.counts.outOfScope !== 2) fail(`expected 2 out of scope (exchangeSigner + near-miss), got ${out.counts.outOfScope}`)
if (!out.outOfScope.some((f) => f.file.includes('exchangeSigner'))) fail('exchangeSigner finding must be RETURNED, not dropped')
if (!out.outOfScope.some((f) => f.file.startsWith('xsrc/'))) fail('xsrc/ near-miss must NOT match src/')
const inS = out.verified.concat(out.unverified).map((f) => f.file)
if (!inS.some((f) => f === 'src/services/wallet.service.ts')) fail('./-prefixed duplicate should merge into src/services/wallet.service.ts')
const acct = out.counts.verified + out.counts.refuted + out.counts.undecided + out.counts.pastCap + out.counts.outOfScope
if (acct !== out.counts.deduped) fail(`reconcile: ${acct} != ${out.counts.deduped}`)
if (logs.some((l) => l.includes('do not reconcile'))) fail('reconcile warning fired')
if (!logs.some((l) => l.startsWith('OUT OF SCOPE') && l.includes('exchangeSigner.test.ts:96 [general]'))) fail('out-of-scope log must name file:line and lens')
if (out.partial) fail('partial should be false with all nodes alive')
console.log(process.exitCode ? 'SMOKE: FAILED' : 'SMOKE: PASS')
