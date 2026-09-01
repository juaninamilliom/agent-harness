export const meta = {
  name: 'plan-graph',
  description: 'Graph plan: a lead partitions the investigation -> cheap investigators return findings anchored on verbatim quotes -> reduce/rank/cap in code -> one fresh refuter per finding -> one strong agent designs the plan -> fake-edge check on its phases',
  whenToUse: 'Planning work whose facts are spread across several subsystems. The graph gathers and verifies the FACTS in parallel; the DESIGN is done once, by one agent. Anything one reader can hold in context is /plan.',
  phases: [
    { title: 'Lead', detail: 'one strong agent reads the code and writes 2-5 partitioned investigation briefs' },
    { title: 'Investigate', detail: 'one cheap read-only investigator per brief; findings with verbatim quotes at file:line' },
    { title: 'Verify', detail: 'one fresh refuter per ranked finding, anchored on the quote; default refuted' },
    { title: 'Synthesize', detail: 'one strong agent designs the plan from the verified facts; code checks its phases for fake edges' },
  ],
}

// ---------------------------------------------------------------------------
// WHY THIS SHAPE (v3, 2026-08-27)
//
// v2 fanned out ARCHITECTS - each designed its domain's slice and the code tried to
// wire the slices together by artifact name. Two real runs showed why that cannot
// work: independent agents name the same artifact differently (29 unresolved needs
// on the wide task), verifying "is this buildable?" refutes nothing (0 of 13), and the
// synthesizer re-did the reduce in prose. The controlled evidence (Kim et al.,
// arXiv:2512.08296) says multi-agent gains +80% on decomposable analysis and loses
// 40-70% on sequential planning; Anthropic's own /deep-research and research-system
// posts say the same in code: a lead plans the angles, cheap workers return FINDINGS
// with quotes, code reduces, skeptics attack facts against anchors, ONE strong agent
// synthesizes. Investigation is decomposable. Design is not. So: graph the
// investigation, design once.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// NODE CONTRACTS - enforced by the tool layer.
// ---------------------------------------------------------------------------

const BRIEF = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'short unique id, e.g. B1' },
    title: { type: 'string' },
    objective: { type: 'string', description: 'the ONE question this investigator answers, about THIS codebase, answerable by reading files' },
    lens: { type: 'string', description: 'the analytical frame a specialist would bring: trust boundaries and money paths / state machine and failure modes / data model and migration traps / test seams and mocks / the user-facing surface / the LLM and prompt surface' },
    boundaries: { type: 'string', description: 'what is OUT of scope for this brief because another brief owns it' },
    filesHint: { type: 'array', items: { type: 'string' }, description: 'repo-relative files or directories to start from; disjoint from the other briefs' },
    agentType: { type: 'string', description: 'optional: a read-only architect agent to run this brief as, when its domain knowledge matters. Omit for the default investigator.' },
  },
  required: ['id', 'title', 'objective', 'lens', 'boundaries', 'filesHint'],
  additionalProperties: false,
}

const BRIEFS_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: '2-3 sentences: what must be true about the codebase for a plan to be right, and how you split it' },
    briefs: { type: 'array', minItems: 2, maxItems: 6, items: BRIEF },
    notPartitioned: { type: 'array', items: { type: 'string' }, description: 'questions you deliberately left out, and why' },
  },
  required: ['summary', 'briefs'],
  additionalProperties: false,
}

const FINDING = {
  type: 'object',
  properties: {
    claim: { type: 'string', description: 'one falsifiable sentence about THIS codebase' },
    file: { type: 'string', description: 'repo-relative path the claim rests on, e.g. server/src/services/x.ts' },
    line: { type: 'integer', description: '1-based line where the quote starts' },
    quote: { type: 'string', description: 'VERBATIM text copied from that file at that line. This is the anchor. No paraphrase. Keep it under ~200 characters.' },
    kind: { enum: ['fact', 'constraint', 'risk', 'gap', 'recommendation'] },
    importance: { enum: ['critical', 'high', 'medium', 'low'] },
    confidence: { enum: ['high', 'medium', 'low'] },
    why: { type: 'string', description: 'one sentence: why this changes the plan' },
  },
  required: ['claim', 'file', 'line', 'quote', 'kind', 'importance', 'confidence'],
  additionalProperties: false,
}

const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    findings: { type: 'array', maxItems: 15, items: FINDING },
    outOfScope: { type: 'array', maxItems: 5, items: FINDING, description: 'things you found that belong to another brief. Report them; do not drop them.' },
    coverage: { type: 'string', description: 'what you read, and what you could NOT establish' },
  },
  required: ['findings', 'coverage'],
  additionalProperties: false,
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    refuted: { type: 'boolean', description: 'true if the CLAIM is false, is not supported by the quote, or the quote is not in the file' },
    evidence: { type: 'string', description: 'the command you ran (check-quote.sh / grep / sed / git) and what it printed' },
    confidence: { enum: ['high', 'medium', 'low'] },
    correction: { type: 'string', description: 'if refuted because the claim is wrong in a specific way: what the code actually says' },
  },
  required: ['refuted', 'evidence', 'confidence'],
  additionalProperties: false,
}

const PHASE = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'P1, P2, ...' },
    title: { type: 'string' },
    commit: { type: 'string', description: 'the commit message' },
    files: { type: 'array', items: { type: 'string' }, description: 'repo-relative files this phase writes or creates' },
    dependsOn: { type: 'array', items: { type: 'string' }, description: 'ids of phases whose ARTIFACT this phase consumes. Not "should come after" - what it cannot be written without.' },
    owner: { type: 'string', description: 'domain owner, e.g. payments, security, frontend' },
    moneyScope: { type: 'boolean', description: 'touches charge / fee / payout / balance / wallet / order placement' },
    notes: { type: 'string' },
  },
  required: ['id', 'title', 'commit', 'files', 'dependsOn', 'owner'],
  additionalProperties: false,
}

const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    plan: { type: 'string', description: 'the full plan as markdown in the /plan output format; cite finding ids like [F3] throughout' },
    phases: { type: 'array', items: PHASE },
    decisions: {
      type: 'array',
      items: {
        type: 'object',
        properties: { question: { type: 'string' }, recommendation: { type: 'string' }, why: { type: 'string' } },
        required: ['question', 'recommendation'],
        additionalProperties: false,
      },
      description: 'product or money decisions a human must make before code',
    },
    risks: {
      type: 'array',
      items: {
        type: 'object',
        properties: { risk: { type: 'string' }, likelihood: { type: 'string' }, impact: { type: 'string' }, mitigation: { type: 'string' }, findings: { type: 'array', items: { type: 'string' } } },
        required: ['risk', 'mitigation'],
        additionalProperties: false,
      },
    },
    gaps: { type: 'array', items: { type: 'string' }, description: 'facts you needed and the graph did not supply. Name them; do not guess them.' },
    outOfScope: { type: 'array', items: { type: 'string' } },
  },
  required: ['plan', 'phases', 'decisions', 'risks'],
  additionalProperties: false,
}

// ---------------------------------------------------------------------------
// ARGS
// ---------------------------------------------------------------------------

const requirements = String((args && args.requirements) || '').trim()
const criteria = String((args && args.criteria) || '').trim()
const workingDir = (args && args.workingDir) || ''
const SCRIPTS = (args && args.harnessRoot ? args.harnessRoot : './.claude') + '/scripts/graph'
if (!requirements) throw new Error('args.requirements is required - the plan needs something to plan')

const intArg = (name, dflt, min, max) => {
  const raw = args && args[name]
  const v = raw === undefined || raw === null ? dflt : Number(raw)
  if (!Number.isInteger(v) || v < min || v > max) throw new Error(`${name}=${JSON.stringify(raw)} must be an integer in [${min}, ${max}]`)
  return v
}
// Kim et al.: past 3-4 workers under a fixed budget, per-agent reasoning gets prohibitively thin.
const MAX_BRIEFS = intArg('maxBriefs', 5, 2, 6)
// /deep-research verifies the top 25 claims by importance; same cap, same reason.
const MAX_VERIFY = intArg('maxVerify', 25, 1, 60)
const VOTES = intArg('votesPerFinding', 1, 1, 3)
const REFUTES_TO_KILL = intArg('refutesToKill', 1, 1, 3)
if (REFUTES_TO_KILL > VOTES) throw new Error(`refutesToKill=${REFUTES_TO_KILL} cannot exceed votesPerFinding=${VOTES}`)

// Strong lead and synthesizer; cheap investigators and refuters. That is the tiering every
// source agrees on and the one v2 had backwards.
const investigatorModel = (args && args.investigatorModel) || 'sonnet'
const verifierModel = (args && args.verifierModel) || 'sonnet'
const leadAgentType = (args && args.leadAgentType) || 'harness:code-architect'
const synthAgentType = (args && args.synthAgentType) || 'harness:code-architect'
const DEFAULT_INVESTIGATOR = 'harness:plan-investigator'
const REFUTER = 'harness:claim-refuter'
// Architects an investigator may run as. Read-only tool sets only: an investigator must
// not be able to edit, build, or run tests. react-architect declares "All tools",
// test-/performance-architect can run npm - excluded. The default is the generic
// architects this plugin ships (harness:-qualified - the plugin's own registry entry,
// not the bare name, is what a plugin consumer's session can actually resolve); pass
// investigatorAgentTypes to add any domain architects declared in the project CLAUDE.md
// routing table (those are typically bare - project-created agents live in the
// project's own .claude/agents/ and resolve without a namespace prefix).
const READ_ONLY_ARCHITECTS = (args && Array.isArray(args.investigatorAgentTypes) && args.investigatorAgentTypes.length)
  ? args.investigatorAgentTypes
  : ['harness:api-architect', 'harness:security-architect', 'harness:db-architect', 'harness:docs-architect', 'harness:code-architect', 'harness:ai-systems-architect']

const WHERE = workingDir
  ? `WORKING DIRECTORY - THIS IS NOT OPTIONAL\n` +
    `  ${workingDir}\n` +
    `  cd there first. Every path is relative to it. This repo may be checked out in more\n` +
    `  than one place; the others are on different branches and reading them will give you\n` +
    `  the wrong answer.`
  : 'Run `git rev-parse --show-toplevel` and work only inside that checkout.'

const CONTEXT = `
Read the project's CLAUDE.md before writing a brief or a finding - it declares the
actual stack, architecture and conventions, and (for a project with more than one
payment rail, blockchain, or similar axis) which one is primary and which is legacy.
`.trim()

log(`Planning: ${requirements.slice(0, 80)}${requirements.length > 80 ? '...' : ''}`)
if (workingDir) log(`Working dir: ${workingDir}`)
else log('WARNING: no workingDir passed - agents may read the wrong checkout')
log(`Budget: <= ${MAX_BRIEFS} investigators (${investigatorModel}), verify top ${MAX_VERIFY} findings x ${VOTES} refuter(s) (${verifierModel}), lead + synthesizer = ${leadAgentType}/${synthAgentType}`)

// ---------------------------------------------------------------------------
// HELPERS - plain code
// ---------------------------------------------------------------------------

const normPath = (p) => String(p || '').replace(/^\.\//, '').replace(/\/+$/, '')
const samePath = (a, b) => {
  a = normPath(a); b = normPath(b)
  return a === b || a.endsWith('/' + b) || b.endsWith('/' + a)
}
const sameGround = (a, b) => samePath(a, b) || normPath(a).startsWith(normPath(b) + '/') || normPath(b).startsWith(normPath(a) + '/')
const normText = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim()
const tokens = (s) => new Set(normText(s).replace(/[^a-z0-9_./:-]+/g, ' ').split(' ').filter((t) => t.length > 2))
const jaccard = (a, b) => {
  const A = tokens(a), B = tokens(b)
  if (!A.size || !B.size) return 0
  let inter = 0
  for (const t of A) if (B.has(t)) inter++
  return inter / (A.size + B.size - inter)
}
const IMPORTANCE = { critical: 0, high: 1, medium: 2, low: 3 }
const KIND = { fact: 0, constraint: 1, risk: 2, gap: 3, recommendation: 4 }
const CONF = { high: 0, medium: 1, low: 2 }

function layer(nodes, edgeList) {
  const ids = nodes.map((n) => n.uid)
  const indeg = new Map(ids.map((u) => [u, 0]))
  const out = new Map(ids.map((u) => [u, []]))
  for (const e of edgeList) {
    if (!indeg.has(e.from) || !indeg.has(e.to)) continue
    indeg.set(e.to, indeg.get(e.to) + 1)
    out.get(e.from).push(e.to)
  }
  const layers = []
  const placed = new Set()
  let frontier = ids.filter((u) => indeg.get(u) === 0)
  while (frontier.length) {
    layers.push(frontier)
    frontier.forEach((u) => placed.add(u))
    const next = []
    for (const u of frontier) for (const v of out.get(u)) { indeg.set(v, indeg.get(v) - 1); if (indeg.get(v) === 0) next.push(v) }
    frontier = next
  }
  return { layers, cyclic: ids.filter((u) => !placed.has(u)) }
}

// ---------------------------------------------------------------------------
// LAYER 0 - LEAD. One strong agent decides what must be true and partitions it.
// Anthropic's research system: "without detailed task descriptions, agents duplicate
// work, leave gaps"; the swarm study: agents that differ only in persona converge on
// the same answer. Variance comes from DIFFERENT QUESTIONS, not different hats.
// ---------------------------------------------------------------------------

phase('Lead')
const lead = await agent(
  `You are the LEAD of a planning graph. You do not write the plan. You decide what must be TRUE ` +
    `about this codebase for a plan to be right, and you split that into 2-${MAX_BRIEFS} investigation ` +
    `briefs that other agents will run in parallel WITHOUT seeing each other or you.\n\n` +
    `## Feature\n${requirements}\n\n` +
    (criteria ? `## Acceptance criteria\n${criteria}\n\n` : '') +
    `${WHERE}\n\n${CONTEXT}\n\n` +
    `## How to work\n` +
    `Read the code first - entry points, models, callers, config - enough to know WHERE the facts ` +
    `live and what a plan could get wrong. Then write the briefs.\n\n` +
    `## Rules for briefs\n` +
    `- Each brief is ONE question about THIS codebase, answerable by reading files. Not "design the ` +
    `API" - "what does the current entry path do, and what does the bracket helper lack that the ` +
    `agent path relies on?"\n` +
    `- PARTITION. Two briefs must not read the same ground. Give each a disjoint filesHint and say in ` +
    `boundaries what the neighbouring brief owns. Investigators that overlap return the same facts ` +
    `under different names, and the reduce cannot merge what it cannot key.\n` +
    `- Give each a lens - the frame a specialist would bring: trust boundaries and money paths; state ` +
    `machines and failure modes; data model and migration traps; test seams and mocks; the user-facing ` +
    `surface; the LLM and prompt surface. The lens is what makes an investigator find the non-obvious ` +
    `fact (a cron that skips idle wallets, a mock allowlist that breaks every suite, a default that is ` +
    `not what the docs say).\n` +
    `- Fewer, sharper briefs beat many overlapping ones. A brief that asks three questions gets three ` +
    `shallow answers from a cheap investigator.\n` +
    `- agentType: you may name one of these read-only architects to run a brief when its domain ` +
    `knowledge matters: ${READ_ONLY_ARCHITECTS.join(', ')}. Otherwise omit it and the default ` +
    `investigator runs it.\n` +
    `- In notPartitioned, list the questions you deliberately left out and why.\n\n` +
    `Structured output only.`,
  { label: 'lead', phase: 'Lead', agentType: leadAgentType, schema: BRIEFS_SCHEMA }
)

if (!lead || !Array.isArray(lead.briefs) || !lead.briefs.length) {
  log('WARNING: the lead returned nothing - no briefs, no investigation, no plan')
  return { partial: true, error: 'lead returned no briefs', counts: { briefs: 0 }, plan: '' }
}

// Validate and normalize the briefs in code.
const seenIds = new Set()
const briefs = lead.briefs.slice(0, MAX_BRIEFS).map((b, i) => {
  let id = String(b.id || `B${i + 1}`)
  if (seenIds.has(id)) id = `${id}-${i + 1}`
  seenIds.add(id)
  const filesHint = (b.filesHint || []).map(normPath)
  let agentType = b.agentType ? String(b.agentType) : DEFAULT_INVESTIGATOR
  if (agentType !== DEFAULT_INVESTIGATOR && !READ_ONLY_ARCHITECTS.includes(agentType)) {
    log(`brief ${id}: agentType "${agentType}" is not on the read-only allowlist - running as ${DEFAULT_INVESTIGATOR}`)
    agentType = DEFAULT_INVESTIGATOR
  }
  return { ...b, id, filesHint, agentType }
})
if (lead.briefs.length > MAX_BRIEFS) log(`Lead wrote ${lead.briefs.length} briefs; running the first ${MAX_BRIEFS} (maxBriefs)`)
if (briefs.length < 2) {
  log(`WARNING: the lead wrote ${briefs.length} brief - one investigator is not a graph. Use /plan.`)
  return { partial: true, error: 'fewer than two briefs', counts: { briefs: briefs.length }, lead, plan: '' }
}

// Overlap check - the partition is the lead's job, but code can see when it failed.
const overlaps = []
for (let i = 0; i < briefs.length; i++) {
  for (let j = i + 1; j < briefs.length; j++) {
    const common = briefs[i].filesHint.filter((f) => briefs[j].filesHint.some((g) => sameGround(f, g)))
    if (common.length) overlaps.push({ a: briefs[i].id, b: briefs[j].id, files: common })
  }
}
log(`Lead: ${briefs.length} briefs - ${briefs.map((b) => `${b.id} (${b.agentType === DEFAULT_INVESTIGATOR ? 'investigator' : b.agentType})`).join(', ')}`)
if (overlaps.length) log(`WARNING: ${overlaps.length} brief pair(s) share ground: ${overlaps.map((o) => `${o.a}/${o.b} on ${o.files.join(', ')}`).join('; ')} - expect duplicate findings`)

// ---------------------------------------------------------------------------
// LAYER 1 - INVESTIGATE. Cheap, read-only, one question each, findings with quotes.
// ---------------------------------------------------------------------------

phase('Investigate')
const INVESTIGATE_PROMPT = (b) =>
  `You are one INVESTIGATOR in a planning graph. You answer ONE question by reading the code. ` +
  `You do not design anything, and you cannot see the other investigators.\n\n` +
  `## Feature (context only)\n${requirements}\n\n` +
  (criteria ? `## Acceptance criteria (context only)\n${criteria}\n\n` : '') +
  `## YOUR BRIEF - ${b.id}: ${b.title}\n` +
  `Question: ${b.objective}\n` +
  `Lens: ${b.lens}\n` +
  `Out of your scope (another brief owns it): ${b.boundaries}\n` +
  `Start from: ${b.filesHint.join(', ') || '(the lead gave no files - find them)'}\n\n` +
  `${WHERE}\n\n${CONTEXT}\n\n` +
  `## Rules\n` +
  `- Every finding is one falsifiable sentence about this codebase, anchored on a VERBATIM quote you ` +
  `copied from file at line. A verifier you will never meet will open that file at that line and ` +
  `check that the quote is there and that it supports the claim. If the quote is paraphrased, the ` +
  `finding dies. Copy it.\n` +
  `- Prefer facts that change the shape of the work: what exists that the plan must reuse; what is ` +
  `missing that the plan must build; what would silently break (a mock allowlist, a cron that skips ` +
  `idle rows, a paranoid model, a lock that is not reentrant, a default that differs from the docs); ` +
  `what a config value makes true today.\n` +
  `- kind: fact (it is so) / constraint (the plan must respect it) / risk (it goes wrong unless) / ` +
  `gap (it does not exist) / recommendation (a design suggestion - allowed, but it must still be ` +
  `anchored on a quote that shows WHY).\n` +
  `- Read broadly around your starting files: follow imports and callers. Do not stop at the first file.\n` +
  `- Stay inside your boundaries. What you find that belongs to another brief goes in outOfScope.\n` +
  `- coverage: what you read, and what you could NOT establish. Silence is not "nothing there".\n` +
  `- Up to 15 findings, ranked by importance. The reduce caps what gets verified.\n\n` +
  `Structured output only.`

const invRaw = await parallel(
  briefs.map((b) => () =>
    agent(INVESTIGATE_PROMPT(b), {
      label: `investigate:${b.id}`, phase: 'Investigate', agentType: b.agentType, model: investigatorModel, schema: FINDINGS_SCHEMA,
    })
  )
)

// Fan-in guard. A missing investigator is not an investigator with no findings - one
// that returned an EMPTY array said "nothing there"; one that returned null said nothing.
// Never count silence as agreement.
const returned = invRaw.filter(Boolean).length
let partial = returned < briefs.length
if (partial) {
  const dead = briefs.filter((_, i) => !invRaw[i]).map((b) => b.id)
  log(`WARNING: ${briefs.length - returned} of ${briefs.length} investigators returned nothing (${dead.join(', ')}) - THIS PLAN IS PARTIAL`)
}

// ---------------------------------------------------------------------------
// LAYER 2 - REDUCE. Plain code. No model. No tokens.
// Findings are homogeneous and keyable (file:line + claim), which is what v2's
// proposals never were. Dedupe merges agreement instead of ordering it.
// ---------------------------------------------------------------------------

const rawFindings = []
invRaw.forEach((r, i) => {
  if (!r) return
  const bid = briefs[i].id
  ;(r.findings || []).forEach((f) => rawFindings.push({ ...f, file: normPath(f.file), briefId: bid, outOfScope: false }))
  ;(r.outOfScope || []).forEach((f) => rawFindings.push({ ...f, file: normPath(f.file), briefId: bid, outOfScope: true }))
})

const deduped = []
for (const f of rawFindings) {
  const twin = deduped.find((d) => samePath(d.file, f.file) && Math.abs(Number(d.line) - Number(f.line)) <= 3 && jaccard(d.claim, f.claim) >= 0.5)
  if (twin) {
    if (!twin.agreedBy.includes(f.briefId)) twin.agreedBy.push(f.briefId)
    // keep the stronger of the two ratings
    if (IMPORTANCE[f.importance] < IMPORTANCE[twin.importance]) twin.importance = f.importance
    if (CONF[f.confidence] < CONF[twin.confidence]) twin.confidence = f.confidence
    continue
  }
  deduped.push({ ...f, agreedBy: [f.briefId] })
}
deduped.forEach((f, i) => { f.id = `F${i + 1}` })

const ranked = [...deduped].sort((a, b) =>
  (IMPORTANCE[a.importance] - IMPORTANCE[b.importance]) ||
  (KIND[a.kind] - KIND[b.kind]) ||
  (b.agreedBy.length - a.agreedBy.length) ||
  (CONF[a.confidence] - CONF[b.confidence])
)
const toVerify = ranked.slice(0, MAX_VERIFY)
const pastCap = ranked.slice(MAX_VERIFY)
log(`Reduce: ${rawFindings.length} raw findings -> ${deduped.length} distinct (${rawFindings.length - deduped.length} merged, ${deduped.filter((f) => f.agreedBy.length > 1).length} agreed by >1 brief, ${deduped.filter((f) => f.outOfScope).length} out-of-scope kept) -> verifying top ${toVerify.length}`)
if (pastCap.length) log(`NOT VERIFIED (past cap ${MAX_VERIFY}): ${pastCap.length} finding(s) - kept, marked unverified`)

if (!deduped.length) {
  log('WARNING: no findings at all - nothing to verify or synthesize')
  return { partial: true, error: 'no findings', counts: { briefs: briefs.length, investigatorsReturned: returned, findingsRaw: 0 }, lead, briefs, plan: '' }
}

// ---------------------------------------------------------------------------
// LAYER 3 - VERIFY. One fresh refuter per finding, anchored on the quote.
// Kopadze s6/s9: the checker checks a real signal against something that cannot argue
// back. The refuter never sees the investigator's reasoning - never the investigator's
// chat, only the finding. Default: refuted. An infra failure is UNVERIFIED, never
// refuted (that is /deep-research's three-outcome rule, and it matters: a rate limit
// must not read as "the code says otherwise").
// ---------------------------------------------------------------------------

phase('Verify')
const VERIFY_PROMPT = (f, v) =>
  `Refute this finding${VOTES > 1 ? ` (refuter ${v + 1}/${VOTES})` : ''}. Default to refuted=true if you cannot establish it with an anchor you ran.\n\n` +
  `## Finding ${f.id}\n` +
  `Claim: ${f.claim}\n` +
  `File: ${f.file}\n` +
  `Line: ${f.line}\n` +
  `Quote: ${JSON.stringify(f.quote)}\n` +
  `Kind: ${f.kind} / importance: ${f.importance}\n\n` +
  `${WHERE}\n\n` +
  `## Checks - run all three\n` +
  `1. Is the quote AT file:line? Run ${SCRIPTS}/check-quote.sh with the file, the line and ` +
  `the quote (single-quote the quote; if it contains a single quote, pass it via a heredoc into a ` +
  `variable). It prints FOUND / NEAR / ELSEWHERE / MISSING. MISSING means the quote is not in the ` +
  `file: refuted. This is the ANCHOR - the shell answers, not you. NEAR or ELSEWHERE is not a ` +
  `refutation by itself; note the real line in evidence.\n` +
  `2. Does the claim FOLLOW from the quote and its surroundings? Read about 40 lines either side and ` +
  `the callers or imports the claim depends on. A quote that exists but does not support the claim is ` +
  `refuted - put what the code actually says in correction.\n` +
  `3. Is it CURRENT? If the claim says something already exists, no longer does, or is the default, ` +
  `confirm it on THIS checkout (grep, git log -1 -- file). A claim about a previous state is refuted, ` +
  `with the correction.\n\n` +
  `You have not seen the investigator that wrote this. Judge the claim against the code. Structured output only.`

const judged = await parallel(
  toVerify.map((f) => () =>
    parallel(
      Array.from({ length: VOTES }, (_, v) => () =>
        agent(VERIFY_PROMPT(f, v), {
          label: `verify:${f.id}:${f.file.split('/').pop()}:${f.line}`, phase: 'Verify', agentType: REFUTER, model: verifierModel, schema: VERDICT_SCHEMA,
        })
      )
    ).then((verdicts) => {
      const valid = verdicts.filter(Boolean)
      const refutes = valid.filter((x) => x.refuted).length
      const survives = valid.length >= REFUTES_TO_KILL && refutes < REFUTES_TO_KILL
      const isRefuted = refutes >= REFUTES_TO_KILL
      const status = survives ? 'confirmed' : isRefuted ? 'refuted' : 'unverified'
      const best = (valid.find((x) => !x.refuted) || valid[0] || {})
      const correction = valid.map((x) => x.correction).filter(Boolean).join(' | ')
      return { ...f, status, voters: valid.length, refutes, evidence: best.evidence || 'no verdict returned', correction: correction || undefined }
    })
  )
)

const settled = judged.filter(Boolean)
if (settled.length < toVerify.length) {
  log(`WARNING: ${toVerify.length - settled.length} finding(s) lost their whole verify node - counts will not reconcile`)
}
if (toVerify.length && settled.every((f) => f.voters === 0)) {
  log(`WARNING: the verify layer is dead - 0 of ${toVerify.length * VOTES} refuters returned. If the failures say "agent type '${REFUTER}' not found", this session's agent registry predates the install: it refreshes on a later turn, so re-run with resumeFromRunId and the lead and investigators replay from cache.`)
}
const confirmed = settled.filter((f) => f.status === 'confirmed')
const refuted = settled.filter((f) => f.status === 'refuted')
const unverifiedInfra = settled.filter((f) => f.status === 'unverified')
const verifyPartial = unverifiedInfra.length > 0 || settled.length < toVerify.length
partial = partial || verifyPartial
log(`Verify: ${settled.length} judged -> ${confirmed.length} confirmed, ${refuted.length} refuted, ${unverifiedInfra.length} unverified (refuter failed)`)
refuted.forEach((f) => log(`  refuted ${f.id} ${f.file}:${f.line} - ${(f.correction || f.evidence).slice(0, 140)}`))

// ---------------------------------------------------------------------------
// LAYER 4 - SYNTHESIZE. One strong agent designs, once, from verified facts.
// Kim et al.: the centralized synthesizer is the "validation bottleneck" that contains
// errors (4.4x vs 17.2x). The hidden-profile result: a group of agents loses private
// facts to premature consensus; one agent holding all the facts does not. So the facts
// are gathered wide and the design is made in ONE context.
// ---------------------------------------------------------------------------

phase('Synthesize')
const fmt = (f, tag) =>
  `[${f.id}]${tag ? ` (${tag})` : ''} ${f.claim}\n` +
  `    ${f.file}:${f.line} - ${f.kind}/${f.importance}/${f.confidence} - from ${f.agreedBy.join('+')}${f.outOfScope ? ' (out of that brief\'s scope)' : ''}\n` +
  `    quote: ${JSON.stringify(String(f.quote).slice(0, 200))}` +
  (f.why ? `\n    why: ${f.why}` : '')
const confirmedBlock = confirmed.map((f) => fmt(f)).join('\n')
const pastCapBlock = pastCap.map((f) => fmt(f, 'UNVERIFIED - past the verify cap')).join('\n')
const infraBlock = unverifiedInfra.map((f) => fmt(f, 'UNVERIFIED - refuter failed')).join('\n')
const refutedBlock = refuted.map((f) => `[${f.id}] ${f.claim}\n    REFUTED: ${f.correction || f.evidence}`).join('\n')

const synth = await agent(
  `You are the SYNTHESIZER of a planning graph. You design the plan ONCE, from verified facts. The ` +
    `graph has already gathered, deduplicated, ranked and verified them. You do not re-derive them and ` +
    `you do not re-investigate: if a fact you need is missing, name it in gaps.\n\n` +
    `## Feature\n${requirements}\n\n` +
    (criteria ? `## Acceptance criteria\n${criteria}\n\n` : '') +
    `${WHERE}\n\n${CONTEXT}\n\n` +
    `## Verified findings (${confirmed.length})\n${confirmedBlock || '(none)'}\n\n` +
    (pastCap.length ? `## Unverified - past the verify cap (${pastCap.length}); use with care and say so\n${pastCapBlock}\n\n` : '') +
    (unverifiedInfra.length ? `## Unverified - the refuter failed (${unverifiedInfra.length}); use with care and say so\n${infraBlock}\n\n` : '') +
    (refuted.length ? `## Refuted (${refuted.length}) - do NOT rely on these; the corrections are what the code says\n${refutedBlock}\n\n` : '') +
    (lead.notPartitioned && lead.notPartitioned.length ? `## Questions the lead chose not to investigate\n- ${lead.notPartitioned.join('\n- ')}\n\n` : '') +
    `## Instructions\n` +
    `1. Corrections to the briefing first: where verified findings contradict the requirements or the ` +
    `acceptance criteria, say so, citing [Fn].\n` +
    `2. Design: the unified approach. Where findings or recommendations conflict, resolve it explicitly ` +
    `and say why. You are the only place judgment happens; do not defer it.\n` +
    `3. Phases with commit boundaries. Each phase lists the files it writes (repo-relative, real) and ` +
    `dependsOn: only phases whose ARTIFACT it consumes - not "should come after". Two phases that write ` +
    `the same file need an order; say which and why. Keep the mock registrations, migrations and the ` +
    `flag with the code that needs them - an intermediate commit must build.\n` +
    `4. decisions: product or money-scope questions a human must answer before code, each with your ` +
    `recommendation and why. Mark moneyScope on every phase that places orders or touches charges, fees, ` +
    `payouts, balances or wallets.\n` +
    `5. risks with mitigations, each tied to finding ids.\n` +
    `6. gaps: facts you needed and did not get. Name them; never guess them.\n` +
    `7. plan: the full markdown, in the /plan output format (Contributing findings, Architectural ` +
    `decisions, Acceptance criteria, Implementation phases, Cross-domain dependencies, Risks). Cite ` +
    `[Fn] throughout so a reader can trace every claim to its anchor.\n\n` +
    `Structured output only.`,
  { label: 'synthesize', phase: 'Synthesize', agentType: synthAgentType, schema: PLAN_SCHEMA }
)

if (!synth) {
  log('WARNING: the synthesize node returned nothing - the verified findings survive in the payload, but no plan was produced')
}

// ---------------------------------------------------------------------------
// POST - the fake-edge test, applied where the article applies it: to a workflow of
// jobs. The phases are jobs. Code checks the edges the synthesizer declared against
// the files the phases write.
//   - two phases writing one file with no edge between them are not independent
//     (false independence): add a shared-file edge, in the order given.
//   - a declared edge between phases that share no file carries an artifact the code
//     cannot see. The synthesizer must have named it; if it cannot, it is a fake edge
//     and the phases can run in parallel. Reported, not deleted - a human decides.
// ---------------------------------------------------------------------------

const phases = (synth && Array.isArray(synth.phases) ? synth.phases : []).map((p, i) => ({
  ...p, id: String(p.id || `P${i + 1}`), uid: String(p.id || `P${i + 1}`), files: (p.files || []).map(normPath), dependsOn: (p.dependsOn || []).map(String),
}))
const phaseIds = new Set(phases.map((p) => p.uid))
let edges = []
const danglingDeps = []
for (const p of phases) {
  for (const d of p.dependsOn) {
    if (!phaseIds.has(d)) { danglingDeps.push({ phase: p.uid, dependsOn: d }); continue }
    if (d === p.uid) continue
    edges.push({ from: d, to: p.uid, reason: 'declared' })
  }
}
const hasEdge = (a, b) => edges.some((e) => (e.from === a && e.to === b) || (e.from === b && e.to === a))
const sharedFileEdgesAdded = []
for (let i = 0; i < phases.length; i++) {
  for (let j = i + 1; j < phases.length; j++) {
    const common = phases[i].files.filter((f) => phases[j].files.some((g) => samePath(f, g)))
    if (common.length && !hasEdge(phases[i].uid, phases[j].uid)) {
      edges.push({ from: phases[i].uid, to: phases[j].uid, reason: 'shared-file', files: common })
      sharedFileEdgesAdded.push({ from: phases[i].uid, to: phases[j].uid, files: common })
    }
  }
}
const unbackedEdges = edges
  .filter((e) => e.reason === 'declared')
  .filter((e) => {
    const a = phases.find((p) => p.uid === e.from), b = phases.find((p) => p.uid === e.to)
    return !a.files.some((f) => b.files.some((g) => samePath(f, g)))
  })
  .map((e) => ({ from: e.from, to: e.to }))
const layered = layer(phases, edges)
if (phases.length) {
  log(`Phases: ${phases.length} -> ${edges.filter((e) => e.reason === 'declared').length} declared edge(s), ${sharedFileEdgesAdded.length} shared-file edge(s) added, ${unbackedEdges.length} declared edge(s) not backed by a shared file (each must name the artifact it carries, or it is a fake edge)`)
  log(`Layers: ${layered.layers.map((l, i) => `L${i}[${l.join(' ')}]`).join(' ')}`)
  if (layered.cyclic.length) log(`WARNING: dependency cycle among ${layered.cyclic.join(', ')} - these have no layer`)
  if (danglingDeps.length) log(`WARNING: ${danglingDeps.length} dependsOn entr(y/ies) name a phase that does not exist: ${danglingDeps.map((d) => `${d.phase}->${d.dependsOn}`).join(', ')}`)
}

// Reconcile: every distinct finding is exactly one of confirmed / refuted / unverified / past cap.
const accounted = confirmed.length + refuted.length + unverifiedInfra.length + pastCap.length
if (accounted !== deduped.length) {
  log(`WARNING: counts do not reconcile - ${deduped.length} findings but ${accounted} accounted for (${deduped.length - accounted} vanished)`)
}

const agentCalls = 1 + briefs.length + toVerify.length * VOTES + 1
return {
  partial: partial || !synth || accounted !== deduped.length,
  counts: {
    briefs: briefs.length, investigatorsReturned: returned, overlaps: overlaps.length,
    findingsRaw: rawFindings.length, findings: deduped.length, agreed: deduped.filter((f) => f.agreedBy.length > 1).length,
    verified: settled.length, confirmed: confirmed.length, refuted: refuted.length, unverified: unverifiedInfra.length, pastCap: pastCap.length,
    phases: phases.length, declaredEdges: edges.filter((e) => e.reason === 'declared').length, sharedFileEdgesAdded: sharedFileEdgesAdded.length, unbackedEdges: unbackedEdges.length,
    agentCalls,
  },
  lead: { summary: lead.summary, notPartitioned: lead.notPartitioned || [] },
  briefs: briefs.map((b) => ({ id: b.id, title: b.title, objective: b.objective, lens: b.lens, agentType: b.agentType, filesHint: b.filesHint })),
  overlaps,
  coverage: invRaw.map((r, i) => ({ brief: briefs[i].id, coverage: r ? r.coverage : null })),
  findings: [
    ...confirmed.map((f) => ({ ...f })),
    ...refuted.map((f) => ({ ...f })),
    ...unverifiedInfra.map((f) => ({ ...f })),
    ...pastCap.map((f) => ({ ...f, status: 'past-cap' })),
  ],
  plan: synth ? synth.plan : '',
  phases,
  edges,
  layers: layered.layers,
  sharedFileEdgesAdded,
  unbackedEdges,
  danglingDeps,
  decisions: synth ? synth.decisions : [],
  risks: synth ? synth.risks : [],
  gaps: synth ? synth.gaps || [] : [],
  outOfScope: synth ? synth.outOfScope || [] : [],
}
