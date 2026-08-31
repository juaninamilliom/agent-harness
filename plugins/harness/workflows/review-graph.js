export const meta = {
  name: 'review-graph',
  description: 'Graph review: parallel lenses -> mechanical reduce -> 3-skeptic majority verify -> synthesize',
  whenToUse: 'Reviewing a diff that touches more than a couple of files. Coordination runs as code, so intermediate findings never enter the session context.',
  phases: [
    { title: 'Lenses', detail: 'distinct review lenses, fresh context each, in parallel' },
    { title: 'Verify', detail: 'three skeptics per finding, different questions; strict majority kills' },
    { title: 'Report', detail: 'synthesize only what survived' },
  ],
}

// ---------------------------------------------------------------------------
// NODE CONTRACTS - enforced, not requested.
// An agent that returns free text is rejected by the tool layer and retried.
// This is the difference between a schema and a note in a markdown file.
// ---------------------------------------------------------------------------

const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string', description: 'repo-relative path' },
          line: { type: 'integer', description: '1-indexed line' },
          severity: { type: 'string', enum: ['critical', 'warning', 'suggestion'] },
          claim: { type: 'string', description: 'one sentence: what is wrong' },
          fix: { type: 'string', description: 'the specific correction' },
        },
        required: ['file', 'line', 'severity', 'claim', 'fix'],
        additionalProperties: false,
      },
    },
  },
  required: ['findings'],
  additionalProperties: false,
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    refuted: { type: 'boolean', description: 'true if you killed the finding' },
    evidence: { type: 'string', description: 'the anchor you actually ran and what it showed' },
    moneyScope: { type: 'boolean', description: 'does this path touch charge/fee/payout/waiver/balance' },
  },
  required: ['refuted', 'evidence', 'moneyScope'],
  additionalProperties: false,
}

// ---------------------------------------------------------------------------
// GRAPH DEFINITION
// ---------------------------------------------------------------------------

const ANCHORS = `
ANCHORS - the only things that count as evidence:
  - "npx tsc --noEmit" in the affected component, output quoted
  - grep results proving a call site does or does not exist
  - git diff - what actually changed
  - the source file, read directly

The jest suite is NOT an anchor. Measured on a production suite, roughly 30% flaky. A
failing test proves nothing and a passing one proves nothing. Never cite test results
either way.
`.trim()

const CONTEXT = `
Read the project's CLAUDE.md before judging any claim - it declares the actual stack,
architecture and conventions, and (for a project with more than one payment rail,
blockchain, or similar axis) which one is primary and which is legacy.
`.trim()

const LENSES = [
  {
    key: 'general',
    agentType: 'pr-review',
    prompt: 'Review this diff as a senior engineer: correctness, security, error handling, code smells.',
  },
  {
    key: 'conventions',
    agentType: 'code-architect',
    prompt:
      'Check this diff against this repo\'s conventions: read the project CLAUDE.md for anything it ' +
      'declares, then compare against the patterns already established in the surrounding code the ' +
      'diff did not touch.',
  },
  {
    key: 'security',
    agentType: 'security-architect',
    prompt: 'Review this diff for auth bypass, secrets exposure, injection, and money-path authorization gaps.',
  },
  {
    key: 'silent-failure',
    agentType: 'pr-review-toolkit:silent-failure-hunter',
    prompt:
      'Hunt this diff for silent failures: swallowed errors, catch blocks that log and continue, ' +
      'fallbacks that mask a real failure, and state transitions that report success on failure. ' +
      'A recurring, expensive bug class in production systems is exactly this - an operation that ' +
      'reports success when it did not happen: a withdrawal marked complete that never sent, a trade ' +
      'marked returned that is still open, a record stuck mid-transition.',
  },
  {
    key: 'tests',
    agentType: 'pr-review-toolkit:pr-test-analyzer',
    prompt: 'Review test coverage for the new logic in this diff. Identify behavioural gaps, not line coverage.',
  },
]

// Three DIFFERENT questions, not three copies of one skeptic.
// Diversity catches failure modes redundancy cannot.
const SKEPTICS = [
  {
    key: 'correct',
    question:
      'Is the claim CORRECT? Read the cited file:line. Does the code actually say what the finding ' +
      'claims? If the line does not exist or does not match, it is refuted.',
  },
  {
    key: 'reachable',
    question:
      'Is the consequence REACHABLE? Trace at least one caller. If no caller can reach the described ' +
      'state - guarded upstream, dead branch, unreachable export - it is refuted.',
  },
  {
    key: 'handled',
    question:
      'Is it ALREADY HANDLED, or OUT OF SCOPE? Grep for the guard, wrapper, type, default or ' +
      'middleware that would prevent it (withErrorHandling, a schema, a non-null type, an early ' +
      'return). Then run `git diff --name-only`: if the cited line is pre-existing and untouched by ' +
      'this diff, it is refuted as out of scope.',
  },
]

const changed = (args && args.changedFiles) || []
const branch = (args && args.branch) || 'working tree'
const workingDir = (args && args.workingDir) || ''

// Path discipline. Without this, an agent resolves a relative path against
// whichever checkout it happens to cd into. Measured on a 19-file production
// review: one skeptic read the main checkout (on the integration branch)
// instead of the review worktree, found the cited line was an eslint pragma
// and the function absent repo-wide, and refuted a real critical. The
// majority outvoted it, but a lens making the same mistake produces silent
// false negatives - it reviews the wrong tree and reports nothing.
const WHERE = workingDir
  ? `WORKING DIRECTORY - THIS IS NOT OPTIONAL\n` +
    `  ${workingDir}\n` +
    `  cd there first. Every path below is relative to it. This repo may be checked out\n` +
    `  in more than one place; the others are on different branches and reading them\n` +
    `  will give you the wrong answer. If a cited line does not match, verify you are\n` +
    `  under ${workingDir} BEFORE concluding the claim is false.`
  : 'Run `git rev-parse --show-toplevel` and work only inside that checkout.'

// Agent budget, enforced in code rather than hoped for in prose.
// 5 lenses + (cap x 3 skeptics) + 1 synthesizer must fit.
// Validate before arithmetic. `NaN < MIN` is false, so a non-numeric maxAgents used
// to pass the floor check, make VERIFY_CAP NaN, slice(0, NaN) to zero findings, and
// early-return "No findings in scope" while carrying EVERY finding in the payload
// with partial:false - after paying for all five lens agents.
const rawMax = args && args.maxAgents
const MAX_AGENTS = rawMax === undefined || rawMax === null ? 15 : Number(rawMax)
const MIN_AGENTS = LENSES.length + SKEPTICS.length + 1
if (!Number.isInteger(MAX_AGENTS) || MAX_AGENTS < MIN_AGENTS) {
  throw new Error(`maxAgents=${JSON.stringify(rawMax)} must be an integer >= ${MIN_AGENTS} (${LENSES.length} lenses + ${SKEPTICS.length} skeptics + 1 synthesizer).`)
}
// No Math.max floor here on purpose - it is what hid the NaN case.
const VERIFY_CAP = Math.floor((MAX_AGENTS - LENSES.length - 1) / SKEPTICS.length)

log(`Reviewing ${branch} - ${changed.length} changed files`)
if (workingDir) log(`Working dir: ${workingDir}`)
else log('WARNING: no workingDir passed - agents may read the wrong checkout')
log(`Budget ${MAX_AGENTS} agents -> ${LENSES.length} lenses, verify cap ${VERIFY_CAP} findings x ${SKEPTICS.length} skeptics`)

// ---------------------------------------------------------------------------
// LAYER 1 - FAN OUT
// A barrier is correct here: the reduce below dedupes across the FULL result set
// before expensive verification. Verifying the same finding from five lenses
// separately is exactly the waste the barrier prevents.
// ---------------------------------------------------------------------------

phase('Lenses')

const scope = changed.length
  ? `Changed files (review ONLY these):\n${changed.map((f) => `  ${f}`).join('\n')}`
  : 'Run `git diff --name-only` yourself and review only those files.'

const raw = await parallel(
  LENSES.map((lens) => () =>
    agent(
      `${lens.prompt}\n\n${WHERE}\n\n${scope}\n\n${CONTEXT}\n\n${ANCHORS}\n\n` +
        'Report only what you can point at a specific file and line for. ' +
        'Do not report pre-existing issues in files you happened to read.',
      { label: `lens:${lens.key}`, phase: 'Lenses', agentType: lens.agentType, schema: FINDINGS_SCHEMA }
    )
  )
)

// ---------------------------------------------------------------------------
// LAYER 2 - REDUCE. Plain code. No model. No tokens.
// ---------------------------------------------------------------------------

// Fan-in guard: a dead node among many slips into a report that looks complete.
const returned = raw.filter(Boolean).length
const partial = returned < LENSES.length
if (partial) {
  const dead = LENSES.filter((_, i) => !raw[i]).map((l) => l.key)
  log(`WARNING: ${LENSES.length - returned} of ${LENSES.length} lenses returned nothing (${dead.join(', ')}) - THIS REPORT IS PARTIAL`)
}

// Segment-aware path match: `src/a.ts` matches `server/src/a.ts` and not `xsrc/a.ts`.
const norm = (p) => String(p || '').replace(/^\.\//, '')
const samePath = (a, b) => {
  a = norm(a); b = norm(b)
  return a === b || a.endsWith('/' + b) || b.endsWith('/' + a)
}
// Canonicalize each finding's path to the caller's spelling of it BEFORE dedupe. Lenses
// write the same file three ways (`./src/x.ts`, `src/x.ts`, `server/src/x.ts`), and
// keyed raw, those were three findings: the agreement signal was lost and the same claim
// burned three skeptics per spelling.
const canon = (file) => (changed.find((c) => samePath(c, file)) || norm(file))
const flat = []
raw.forEach((result, i) => {
  if (!result || !result.findings) return
  result.findings.forEach((f) => flat.push({ ...f, file: canon(f.file), lens: LENSES[i].key }))
})

// Dedupe by file:line. Two lenses agreeing is one finding, and agreement is signal.
const byKey = new Map()
for (const f of flat) {
  const key = `${f.file}:${f.line}`
  const prior = byKey.get(key)
  if (prior) prior.lenses.push(f.lens)
  else byKey.set(key, { ...f, lenses: [f.lens] })
}

const all = [...byKey.values()]
const inScope = all.filter((f) => !changed.length || changed.some((c) => samePath(c, f.file)))
// Out-of-scope findings are NOT dropped. Measured on a 19-file production review: a
// hand-typed changedFiles list carried 17 of the PR's 19 files, and a real finding in
// one of the missing two (exchangeSigner.test.ts:96) vanished here - no log line, no
// payload entry - while the reconcile below counted against inScope, so the books
// balanced.
// A finding outside the declared scope is either a lens ignoring its brief or a caller
// under-declaring the diff, and the caller cannot tell which if it never sees it.
const outOfScope = all.filter((f) => !inScope.includes(f))
if (outOfScope.length) {
  log(`OUT OF SCOPE - returned in \`outOfScope\`, not verified: ` +
      outOfScope.map((f) => `${f.file}:${f.line} [${f.lenses.join(',')}]`).join('; '))
}

const RANK = { critical: 0, warning: 1, suggestion: 2 }
inScope.sort((a, b) => (RANK[a.severity] ?? 3) - (RANK[b.severity] ?? 3) || b.lenses.length - a.lenses.length)

const toVerify = inScope.slice(0, VERIFY_CAP)
const unverified = inScope.slice(VERIFY_CAP)

log(`Reduce: ${flat.length} raw -> ${byKey.size} deduped -> ${inScope.length} in scope (${outOfScope.length} out) -> ${toVerify.length} verifying`)
if (unverified.length) log(`NOT VERIFIED (past cap): ${unverified.length} findings - reported as unverified, not dropped`)

if (!toVerify.length) {
  return {
    branch,
    partial,
    counts: { raw: flat.length, deduped: byKey.size, inScope: inScope.length, outOfScope: outOfScope.length, verified: 0, refuted: 0, pastCap: unverified.length, undecided: 0, unverified: unverified.length },
    verified: [],
    refutedFindings: [],
    unverified,
    outOfScope,
    report: 'No findings in scope.',
  }
}

// ---------------------------------------------------------------------------
// LAYER 3 - VERIFY. Three different questions per finding; strict majority kills.
// Each skeptic is a fresh context that never sees the lens's reasoning -
// only the claim and the code.
// ---------------------------------------------------------------------------

phase('Verify')

const judged = await parallel(
  toVerify.map((f) => () =>
    parallel(
      SKEPTICS.map((s) => () =>
        agent(
          `Refute this code-review finding. Default to refuted=true if you cannot establish it.\n\n` +
            `FINDING\n  file: ${f.file}\n  line: ${f.line}\n  claim: ${f.claim}\n  proposed fix: ${f.fix}\n\n` +
            `YOUR QUESTION\n${s.question}\n\n${WHERE}\n\n${ANCHORS}\n\n` +
            'You have NOT seen the reasoning that produced this finding. Do not ask for it. ' +
            'Judge the claim against the code.',
          { label: `verify:${s.key}:${f.file}:${f.line}`, phase: 'Verify', agentType: 'finding-refuter', schema: VERDICT_SCHEMA }
        )
      )
    ).then((votes) => {
      const live = votes.filter(Boolean)
      const kills = live.filter((v) => v.refuted).length
      // Layer 1 has a fan-in guard; this layer needs one too. Fewer than two live
      // skeptics is not a verdict - reporting it as "refuted" would present a dead
      // verify node as a judgement, and one voter is not a panel.
      // A finding dies only on a STRICT majority of live skeptics. A 1-1 tie is not
      // a verdict and must not be presented as one: the default-to-DROP bias already
      // lives inside each skeptic's own prompt, so applying it again here would
      // double-count it, and reporting an unresolved split under refutedFindings
      // claims a judgement that never happened.
      const undecided = live.length < 2 || kills * 2 === live.length
      const survived = !undecided && kills * 2 < live.length
      return {
        ...f,
        survived,
        undecided,
        kills,
        voters: live.length,
        moneyScope: live.some((v) => v.moneyScope),
        evidence: (live.find((v) => !v.refuted) || live[0] || {}).evidence || 'no verdict returned',
        dissent: live.filter((v) => v.refuted).map((v) => v.evidence),
      }
    })
  )
)

const settled = judged.filter(Boolean)
if (settled.length < toVerify.length) {
  log(`WARNING: ${toVerify.length - settled.length} finding(s) lost their whole verify node - counts will not reconcile`)
}
if (toVerify.length && settled.every((f) => f.voters === 0)) {
  log(`WARNING: the verify layer is dead - 0 of ${toVerify.length * SKEPTICS.length} skeptics returned. If the failures say "agent type 'finding-refuter' not found", this session's agent registry predates the install: it refreshes on a later turn, so re-run with resumeFromRunId and the lenses replay from cache.`)
}
const verified = settled.filter((f) => f.survived)
const undecidedFindings = settled.filter((f) => f.undecided)
const refuted = settled.filter((f) => !f.survived && !f.undecided)
const verifyPartial = undecidedFindings.length > 0 || settled.length < toVerify.length

log(`Verify: ${settled.length} judged -> ${verified.length} survived, ${refuted.length} refuted`)
if (verifyPartial) {
  log(`WARNING: ${undecidedFindings.length} finding(s) had fewer than 2 live skeptics - reported as UNVERIFIED, not refuted`)
}

// ---------------------------------------------------------------------------
// LAYER 4 - SYNTHESIZE
// ---------------------------------------------------------------------------

phase('Report')

const report = verified.length
  ? await agent(
      'Write one ranked code review report from these VERIFIED findings. Each already survived ' +
        'three independent skeptics, so do not re-litigate them - present them.\n\n' +
        'Group as Critical / Warnings / Suggestions. Put any finding with moneyScope=true in a ' +
        'separate "Money scope - needs sign-off" section and state plainly that it must not be ' +
        'auto-applied.\n\nCite file:line for each. Quote the evidence. Be terse.\n\n' +
        JSON.stringify(verified, null, 2),
      { label: 'synthesize', phase: 'Report' }
    )
  : 'No findings survived verification.'

if (verified.length && !report) {
  log('WARNING: the synthesize node returned nothing - findings survive in `verified`, but no written report was produced')
}

// §7.3 applies to the merge itself: every finding in scope must end up in exactly
// one bucket. If they do not add up, a node died somewhere without saying so.
// Reconcile against the DEDUPED set, not inScope - a finding lost between the two used
// to balance the books by never being counted at all.
const accounted = verified.length + refuted.length + undecidedFindings.length + unverified.length + outOfScope.length
if (accounted !== byKey.size) {
  log(`WARNING: counts do not reconcile - ${byKey.size} deduped findings but ${accounted} accounted for (${byKey.size - accounted} vanished)`)
}
return {
  branch,
  partial: partial || verifyPartial || (verified.length > 0 && !report) || accounted !== byKey.size,
  counts: {
    raw: flat.length,
    deduped: byKey.size,
    inScope: inScope.length,
    outOfScope: outOfScope.length,
    verified: verified.length,
    refuted: refuted.length,
    pastCap: unverified.length,
    undecided: undecidedFindings.length,
    unverified: unverified.length + undecidedFindings.length,
  },
  verified,
  refutedFindings: refuted.map((f) => ({ file: f.file, line: f.line, claim: f.claim, killedBy: f.dissent })),
  unverified: [...unverified, ...undecidedFindings],
  outOfScope,
  report,
}
