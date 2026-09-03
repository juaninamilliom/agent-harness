export const meta = {
  name: 'plan-graph',
  description: 'Graph plan. Existing code: a lead partitions the investigation -> cheap investigators return findings anchored on verbatim quotes -> reduce/rank/cap in code -> one fresh refuter per finding. Greenfield: a lead extracts the decisions the brief forces and lays the contract skeleton -> one specialist per domain answers and elaborates its slice -> integrity in code -> a fresh validator finds conflicts -> one repair round -> the rest go to the human. Either way: one strong agent designs the plan once, code checks its phases for fake edges, and a GraphState (schemas/graph-state.schema.json) comes back on every path.',
  whenToUse: 'Planning work whose facts (existing code) or design decisions (a new project) span several subsystems. The graph gathers and verifies the FACTS or the DECISIONS in parallel; the DESIGN is done once, by one agent. Anything one reader can hold in context is /plan.',
  phases: [
    { title: 'Lead', detail: 'one strong agent reads the code (or the brief) and partitions the investigation (or the decisions)' },
    { title: 'Investigate', detail: 'existing mode: one cheap read-only investigator per brief; findings with verbatim quotes at file:line' },
    { title: 'Verify', detail: 'existing mode: one fresh refuter per ranked finding, anchored on the quote; default refuted' },
    { title: 'Design', detail: 'greenfield mode: one specialist per domain answers its decisions and elaborates its contract slice' },
    { title: 'Validate', detail: 'greenfield mode: one fresh validator checks the contract and decisions for conflicts; never sees the specialists' },
    { title: 'Repair', detail: 'greenfield mode: each owning specialist gets only its conflicts, once; what remains goes to the human' },
    { title: 'Synthesize', detail: 'one strong agent designs the plan from the verified facts or validated decisions; code checks its phases for fake edges' },
  ],
}

// ---------------------------------------------------------------------------
// WHY THIS SHAPE (v3, 2026-08-27; greenfield mode 2026-09-03)
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
//
// GREENFIELD MODE re-reads v2's failure: what failed was fanning out design WITHOUT a
// shared naming ground and WITHOUT a validator that could send a mismatch back. So
// here the LEAD mints every id up front (the contract skeleton - endpoints, tables,
// routes, types, names only), specialists elaborate ONLY the slice they own and answer
// ONLY their decisions, code checks every reference at the fan-in, a fresh validator
// finds where the slices disagree, and each owner gets its conflicts back exactly once.
// What still conflicts is a human's decision, recorded as such. The synthesizer still
// designs once. Nothing is merged by name; nothing is wired in prose.
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

// --- greenfield contracts ---------------------------------------------------

const GF_DOMAINS = ['data', 'api', 'ui', 'auth', 'test', 'infra', 'other']
// Each contract slice has exactly one owning domain and one id letter. A specialist's
// write to a slice it does not own is discarded and logged - the need goes in a
// decision's refs instead. That single-writer rule is what makes the merge mechanical.
const SLICE_OWNER = { data: 'data', api: 'api', ui: 'ui', types: 'api' }
const SLICE_LETTER = { data: 'T', api: 'E', ui: 'R', types: 'Y' }

const GF_DECISION_BRIEF = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'D1, D2, ...' },
    domain: { enum: GF_DOMAINS, description: 'the specialist that owns this decision' },
    question: { type: 'string', description: 'the ONE design question a specialist can answer with options and a recommendation' },
    why: { type: 'string', description: 'one sentence: what goes wrong in the plan if this is decided badly' },
    cites: { type: 'array', items: { type: 'integer' }, description: 'indexes (from 0) into the acceptance criteria this decision serves' },
    dependsOn: { type: 'array', items: { type: 'string' }, description: 'decision ids this one cannot be answered without' },
  },
  required: ['id', 'domain', 'question', 'why', 'cites'],
  additionalProperties: false,
}
const skeletonItem = (extra) => ({
  type: 'object',
  properties: { id: { type: 'string' }, ...extra, purpose: { type: 'string', description: 'one line' } },
  required: ['id', ...Object.keys(extra), 'purpose'],
  additionalProperties: false,
})
const GF_LEAD_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: '2-3 sentences: what this brief forces you to decide, and how you split it' },
    decisions: { type: 'array', minItems: 2, maxItems: 12, items: GF_DECISION_BRIEF },
    contract: {
      type: 'object',
      description: 'the SKELETON of the shared contract - ids and names only, no detail. Specialists elaborate these and reference them by id. Omit slices this application does not have.',
      properties: {
        api: { type: 'array', items: skeletonItem({ method: { type: 'string' }, path: { type: 'string' } }) },
        data: { type: 'array', items: skeletonItem({ name: { type: 'string' } }) },
        ui: { type: 'array', items: skeletonItem({ path: { type: 'string' } }) },
        types: { type: 'array', items: skeletonItem({ name: { type: 'string' } }) },
      },
      additionalProperties: false,
    },
    notPartitioned: { type: 'array', items: { type: 'string' }, description: 'decisions you deliberately left out, and why' },
  },
  required: ['summary', 'decisions', 'contract'],
  additionalProperties: false,
}

const strings = { type: 'array', items: { type: 'string' } }
const ENDPOINT = {
  type: 'object',
  properties: {
    id: { type: 'string' }, method: { type: 'string' }, path: { type: 'string' }, purpose: { type: 'string' },
    auth: { enum: ['none', 'session'] }, request: { type: 'string', description: 'the request shape, e.g. {body: string} or ?cursor' }, response: { type: 'string', description: 'the response shape' },
    errors: strings, reads: { ...strings, description: 'table ids (T#) this endpoint reads' }, writes: { ...strings, description: 'table ids (T#) this endpoint writes' },
  },
  required: ['id', 'method', 'path', 'purpose', 'auth', 'request', 'response', 'errors', 'reads', 'writes'],
  additionalProperties: false,
}
const TABLE = {
  type: 'object',
  properties: {
    id: { type: 'string' }, name: { type: 'string' }, purpose: { type: 'string' },
    columns: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, type: { type: 'string' }, nullable: { type: 'boolean' }, ref: { type: 'string', description: 'the table id (T#) this column references, if any' } }, required: ['name', 'type', 'nullable'], additionalProperties: false } },
    indexes: strings,
  },
  required: ['id', 'name', 'purpose', 'columns', 'indexes'],
  additionalProperties: false,
}
const ROUTE = {
  type: 'object',
  properties: {
    id: { type: 'string' }, path: { type: 'string' }, purpose: { type: 'string' }, components: strings,
    reads: { ...strings, description: 'endpoint ids (E#) this route calls to read' }, writes: { ...strings, description: 'endpoint ids (E#) this route calls to write' },
  },
  required: ['id', 'path', 'purpose', 'components', 'reads', 'writes'],
  additionalProperties: false,
}
const SHARED = {
  type: 'object',
  properties: { id: { type: 'string' }, name: { type: 'string' }, purpose: { type: 'string' }, shape: { type: 'string' }, usedBy: { ...strings, description: 'endpoint and route ids that carry this type' } },
  required: ['id', 'name', 'shape', 'usedBy'],
  additionalProperties: false,
}
const DESIGN_SCHEMA = {
  type: 'object',
  properties: {
    decisions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'one of YOUR decision ids, as given' },
          options: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, tradeoffs: { type: 'string' } }, required: ['name', 'tradeoffs'], additionalProperties: false } },
          recommendation: { type: 'string', description: 'ONE option, stated as the decision' },
          why: { type: 'string' },
          cites: { type: 'array', items: { type: 'integer' }, description: 'acceptance criteria indexes this recommendation serves' },
          refs: { ...strings, description: 'contract ids (E# T# R# Y#) this recommendation rests on. A recommendation that cites nothing and refs nothing goes to a human.' },
        },
        required: ['id', 'options', 'recommendation', 'why', 'cites', 'refs'],
        additionalProperties: false,
      },
    },
    contract: {
      type: 'object',
      description: 'ONLY the slices you own, complete. Keep skeleton ids. New items: give an id in the slice letter; the code renumbers.',
      properties: { api: { type: 'array', items: ENDPOINT }, data: { type: 'array', items: TABLE }, ui: { type: 'array', items: ROUTE }, types: { type: 'array', items: SHARED } },
      additionalProperties: false,
    },
    notes: { type: 'string', description: 'what you could not decide from the brief alone' },
  },
  required: ['decisions', 'contract'],
  additionalProperties: false,
}
const CONSISTENCY_SCHEMA = {
  type: 'object',
  properties: {
    conflicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'the decision id or contract item id that is wrong' },
          owner: { enum: GF_DOMAINS, description: 'the domain that must fix it: the slice owner (data / api / ui; types -> api) or the decision\'s domain' },
          problem: { type: 'string', description: 'the two things that cannot both hold, by id' },
          fix: { type: 'string', description: 'the smallest change that resolves it' },
        },
        required: ['id', 'owner', 'problem', 'fix'],
        additionalProperties: false,
      },
    },
    uncovered: { type: 'array', items: { type: 'integer' }, description: 'acceptance criteria indexes no decision and no contract item serves' },
    summary: { type: 'string' },
  },
  required: ['conflicts', 'uncovered', 'summary'],
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
    refs: { type: 'array', items: { type: 'string' }, description: 'the ids this phase rests on or implements: finding ids [Fn] in existing mode; decision and contract ids [Dn] [En] [Tn] [Rn] [Yn] in greenfield mode' },
    notes: { type: 'string' },
  },
  required: ['id', 'title', 'commit', 'files', 'dependsOn', 'owner'],
  additionalProperties: false,
}

const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    plan: { type: 'string', description: 'the full plan as markdown in the /plan output format; cite ids like [F3] or [E2] throughout' },
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
        properties: { risk: { type: 'string' }, likelihood: { type: 'string' }, impact: { type: 'string' }, mitigation: { type: 'string' }, refs: { type: 'array', items: { type: 'string' }, description: 'ids this risk is tied to' } },
        required: ['risk', 'mitigation'],
        additionalProperties: false,
      },
    },
    gaps: { type: 'array', items: { type: 'string' }, description: 'facts or decisions you needed and the graph did not supply. Name them; do not guess them.' },
    outOfScope: { type: 'array', items: { type: 'string' } },
  },
  required: ['plan', 'phases', 'decisions', 'risks'],
  additionalProperties: false,
}

// ---------------------------------------------------------------------------
// ARGS
// ---------------------------------------------------------------------------

const requirements = String((args && args.requirements) || '').trim()
// Acceptance criteria live in the state one per entry - validators cite them by index.
// A string is accepted too (the skill has always passed one) and split on newlines.
const criteriaList = (Array.isArray(args && args.criteria) ? args.criteria : String((args && args.criteria) || '').split('\n')).map((c) => String(c).trim()).filter(Boolean)
const criteria = criteriaList.join('\n')
const constraints = (Array.isArray(args && args.constraints) ? args.constraints : []).map((c) => String(c).trim()).filter(Boolean)
const workingDir = (args && args.workingDir) || ''
const harnessRoot = String((args && args.harnessRoot) || '').trim()
const integrationBranch = String((args && args.integrationBranch) || '').trim()
const runId = String((args && args.runId) || '')
// The router's choice, made by the skill with a shell probe (is there code to read?).
// Scripts cannot touch the filesystem, so the mode arrives as an arg.
const MODE = String((args && args.mode) || 'existing')
if (!['existing', 'greenfield'].includes(MODE)) throw new Error(`mode=${JSON.stringify(args && args.mode)} must be "existing" or "greenfield"`)
if (!requirements) throw new Error('args.requirements is required - the plan needs something to plan')
// No fallback: the old './.claude' default resolved to nothing on disk and degraded silently.
if (!harnessRoot) throw new Error('args.harnessRoot is required - it locates check-quote.sh')
const SCRIPTS = harnessRoot + '/scripts/graph'

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
// Greenfield: a conflict goes back to its owner this many times, then to the human.
const MAX_REPAIR_ROUNDS = intArg('maxRepairRounds', 1, 0, 2)

// Strong lead and synthesizer; cheap investigators and refuters. That is the tiering every
// source agrees on and the one v2 had backwards.
const investigatorModel = (args && args.investigatorModel) || 'sonnet'
const verifierModel = (args && args.verifierModel) || 'sonnet'
const leadAgentType = (args && args.leadAgentType) || 'harness:code-architect'
const synthAgentType = (args && args.synthAgentType) || 'harness:code-architect'
const validatorAgentType = (args && args.validatorAgentType) || 'harness:code-architect'
const DEFAULT_INVESTIGATOR = 'harness:plan-investigator'
const REFUTER = 'harness:claim-refuter'
// Greenfield specialists, one per domain. Read-only architects by default; pass
// specialistAgentTypes to substitute (e.g. a project's own domain architect).
const specialistTypes = {
  data: 'harness:db-architect', api: 'harness:api-architect', ui: 'harness:frontend-architect', auth: 'harness:security-architect',
  test: 'harness:test-architect', infra: 'harness:code-architect', other: 'harness:code-architect',
  ...((args && args.specialistAgentTypes && typeof args.specialistAgentTypes === 'object' && !Array.isArray(args.specialistAgentTypes)) ? args.specialistAgentTypes : {}),
}
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

const BRIEF_BLOCK = () =>
  `## Feature\n${requirements}\n\n` +
  (criteriaList.length ? `## Acceptance criteria (cite by index)\n${criteriaList.map((c, i) => `[${i}] ${c}`).join('\n')}\n\n` : '') +
  (constraints.length ? `## Constraints\n- ${constraints.join('\n- ')}\n\n` : '')

log(`Planning (${MODE}): ${requirements.slice(0, 80)}${requirements.length > 80 ? '...' : ''}`)
if (workingDir) log(`Working dir: ${workingDir}`)
else log('WARNING: no workingDir passed - agents may read the wrong checkout')
if (MODE === 'existing') log(`Budget: <= ${MAX_BRIEFS} investigators (${investigatorModel}), verify top ${MAX_VERIFY} findings x ${VOTES} refuter(s) (${verifierModel}), lead + synthesizer = ${leadAgentType}/${synthAgentType}`)
else log(`Budget: one specialist per domain the lead activates, ${MAX_REPAIR_ROUNDS} repair round(s), validator = ${validatorAgentType}, lead + synthesizer = ${leadAgentType}/${synthAgentType}`)

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
// THE STATE. Every path out of this script - clean, partial, early exit - returns a
// GraphState (schemas/graph-state.schema.json): the object the invoking skill persists
// to .claude/graph-state/<run id>.json and the next graph reads as args.state. Never
// the chat. Sections this graph does not write (artifacts, validations, repairs - and
// facts or decisions/contract, depending on the mode) are present and empty so a
// consumer can rely on the shape.
// ---------------------------------------------------------------------------

const stateBase = () => ({
  version: 1,
  run: { id: runId, graph: 'plan-graph', mode: MODE, workingDir, harnessRoot, integrationBranch, partial: false, errors: [], counts: {} },
  brief: { requirements, criteria: criteriaList, constraints },
  lead: { summary: '', notPartitioned: [], overlaps: [] },
  briefs: [],
  facts: [],
  decisions: [],
  contract: {},
  plan: '',
  phases: [],
  edges: [],
  layers: [],
  sharedFileEdgesAdded: [],
  unbackedEdges: [],
  danglingDeps: [],
  danglingRefs: [],
  risks: [],
  gaps: [],
  humanDecisions: [],
  outOfScope: [],
  artifacts: {},
  validations: [],
  repairs: [],
})
// Assemble a state from the base plus whatever this path produced; `run` merges.
const finish = (over) => { const base = stateBase(); return { ...base, ...over, run: { ...base.run, ...(over.run || {}) } } }
// Drop undefined-valued keys so the state round-trips through JSON unchanged.
const compact = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))
const leadOut = (l, overlaps) => ({ summary: String((l && l.summary) || ''), notPartitioned: (l && l.notPartitioned) || [], overlaps: overlaps || [] })
// coverage is null when the investigator returned nothing: a missing investigator is
// not an investigator with no findings, and the state must say which it was.
const briefsOut = (bs, inv) => bs.map((b, i) => ({
  id: b.id, title: b.title, objective: b.objective, lens: b.lens, boundaries: b.boundaries, filesHint: b.filesHint, agentType: b.agentType,
  coverage: inv && inv[i] && typeof inv[i].coverage === 'string' ? inv[i].coverage : null,
}))
const dedupeRefs = (rs) => { const seen = new Set(); return rs.filter((r) => { const k = `${r.from} ${r.ref}`; if (seen.has(k)) return false; seen.add(k); return true }) }

// ===========================================================================
// EXISTING MODE - Lead -> Investigate -> Reduce -> Verify. Returns the fact base.
// ===========================================================================

async function investigate() {
  // -------------------------------------------------------------------------
  // LAYER 0 - LEAD. One strong agent decides what must be true and partitions it.
  // Anthropic's research system: "without detailed task descriptions, agents duplicate
  // work, leave gaps"; the swarm study: agents that differ only in persona converge on
  // the same answer. Variance comes from DIFFERENT QUESTIONS, not different hats.
  // -------------------------------------------------------------------------

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
    return { exit: finish({ run: { partial: true, errors: ['lead returned no briefs'], counts: { briefs: 0 } } }) }
  }

  // Validate and normalize the briefs in code. Ids are the vocabulary of the state, so
  // the code assigns them - B1.. in the lead's order, whatever the lead wrote.
  const renamedBriefs = []
  const briefs = lead.briefs.slice(0, MAX_BRIEFS).map((b, i) => {
    const id = `B${i + 1}`
    if (b.id && String(b.id) !== id) renamedBriefs.push(`${b.id}->${id}`)
    const filesHint = (b.filesHint || []).map(normPath)
    let agentType = b.agentType ? String(b.agentType) : DEFAULT_INVESTIGATOR
    if (agentType !== DEFAULT_INVESTIGATOR && !READ_ONLY_ARCHITECTS.includes(agentType)) {
      log(`brief ${id}: agentType "${agentType}" is not on the read-only allowlist - running as ${DEFAULT_INVESTIGATOR}`)
      agentType = DEFAULT_INVESTIGATOR
    }
    return { ...b, id, boundaries: String(b.boundaries || ''), filesHint, agentType }
  })
  if (renamedBriefs.length) log(`Briefs renamed to positional ids: ${renamedBriefs.join(', ')}`)
  if (lead.briefs.length > MAX_BRIEFS) log(`Lead wrote ${lead.briefs.length} briefs; running the first ${MAX_BRIEFS} (maxBriefs)`)
  if (briefs.length < 2) {
    log(`WARNING: the lead wrote ${briefs.length} brief - one investigator is not a graph. Use /plan.`)
    return { exit: finish({ run: { partial: true, errors: ['fewer than two briefs'], counts: { briefs: briefs.length } }, lead: leadOut(lead, []), briefs: briefsOut(briefs, null) }) }
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

  // -------------------------------------------------------------------------
  // LAYER 1 - INVESTIGATE. Cheap, read-only, one question each, findings with quotes.
  // -------------------------------------------------------------------------

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
  const deadInvestigators = briefs.filter((_, i) => !invRaw[i]).map((b) => b.id)
  let partial = returned < briefs.length
  if (partial) {
    log(`WARNING: ${briefs.length - returned} of ${briefs.length} investigators returned nothing (${deadInvestigators.join(', ')}) - THIS PLAN IS PARTIAL`)
  }
  // Errors are named in the state, never only in the log.
  const errors = deadInvestigators.length ? [`${deadInvestigators.length} of ${briefs.length} investigators returned nothing: ${deadInvestigators.join(', ')}`] : []

  // -------------------------------------------------------------------------
  // LAYER 2 - REDUCE. Plain code. No model. No tokens.
  // Findings are homogeneous and keyable (file:line + claim), which is what v2's
  // proposals never were. Dedupe merges agreement instead of ordering it.
  // -------------------------------------------------------------------------

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
    return { exit: finish({
      run: { partial: true, errors: [...errors, 'no findings'], counts: { briefs: briefs.length, investigatorsReturned: returned, overlaps: overlaps.length, findingsRaw: 0 } },
      lead: leadOut(lead, overlaps), briefs: briefsOut(briefs, invRaw),
    }) }
  }

  // -------------------------------------------------------------------------
  // LAYER 3 - VERIFY. One fresh refuter per finding, anchored on the quote.
  // Kopadze s6/s9: the checker checks a real signal against something that cannot argue
  // back. The refuter never sees the investigator's reasoning - never the investigator's
  // chat, only the finding. Default: refuted. An infra failure is UNVERIFIED, never
  // refuted (that is /deep-research's three-outcome rule, and it matters: a rate limit
  // must not read as "the code says otherwise").
  // -------------------------------------------------------------------------

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
  if (unverifiedInfra.length) errors.push(`${unverifiedInfra.length} finding(s) unverified - the refuter failed`)
  if (settled.length < toVerify.length) errors.push(`${toVerify.length - settled.length} finding(s) lost their verify node`)
  log(`Verify: ${settled.length} judged -> ${confirmed.length} confirmed, ${refuted.length} refuted, ${unverifiedInfra.length} unverified (refuter failed)`)
  refuted.forEach((f) => log(`  refuted ${f.id} ${f.file}:${f.line} - ${(f.correction || f.evidence).slice(0, 140)}`))

  // Reconcile: every distinct finding is exactly one of confirmed / refuted / unverified / past cap.
  const accounted = confirmed.length + refuted.length + unverifiedInfra.length + pastCap.length
  if (accounted !== deduped.length) {
    log(`WARNING: counts do not reconcile - ${deduped.length} findings but ${accounted} accounted for (${deduped.length - accounted} vanished)`)
    errors.push(`counts do not reconcile: ${deduped.length - accounted} finding(s) vanished`)
    partial = true
  }

  return {
    lead, briefs, overlaps, invRaw, confirmed, refuted, unverifiedInfra, pastCap, partial, errors,
    counts: {
      briefs: briefs.length, investigatorsReturned: returned, overlaps: overlaps.length,
      findingsRaw: rawFindings.length, findings: deduped.length, agreed: deduped.filter((f) => f.agreedBy.length > 1).length,
      verified: settled.length, confirmed: confirmed.length, refuted: refuted.length, unverified: unverifiedInfra.length, pastCap: pastCap.length,
      agentCalls: 1 + briefs.length + toVerify.length * VOTES,
    },
  }
}

// ===========================================================================
// GREENFIELD MODE - Lead -> Design -> Integrity -> Validate -> Repair. Returns the
// validated decisions and the shared contract.
// ===========================================================================

async function design() {
  const errors = []
  let partial = false
  const danglingRefs = []

  // -------------------------------------------------------------------------
  // LAYER G0 - LEAD. One strong agent reads the BRIEF and decides what must be DECIDED,
  // then lays the naming ground: the contract skeleton, ids and names only. The lead
  // mints every id. Specialists elaborate; they do not rename.
  // -------------------------------------------------------------------------

  phase('Lead')
  const gl = await agent(
    `You are the LEAD of a planning graph in GREENFIELD mode: there is no code to read. You do not ` +
      `design. You decide what must be DECIDED for a plan to be right, and you lay the naming ground ` +
      `the specialists will design against, in parallel, WITHOUT seeing each other or you.\n\n` +
      BRIEF_BLOCK() +
      `${WHERE}\n\nIf a CLAUDE.md exists, read it: it declares the stack and conventions. Otherwise the ` +
      `constraints above are the stack.\n\n` +
      `## What you produce\n` +
      `1. decisions: the design decisions this brief FORCES - 2 to 12. Each is ONE question a specialist ` +
      `can answer with options and a recommendation; tagged with the domain that owns it (data / api / ` +
      `ui / auth / test / infra / other); citing the acceptance criteria indexes it serves; dependsOn ` +
      `the decisions it cannot be answered without. PARTITION: two decisions must not be the same ` +
      `question in different words. Fewer, sharper decisions beat many overlapping ones.\n` +
      `2. contract: the SKELETON of the shared contract - ids and names only, no detail: api endpoints ` +
      `(E1.., method, path, purpose), data tables (T1.., name, purpose), ui routes (R1.., path, ` +
      `purpose), shared types (Y1.., name, purpose). This is the naming ground: every specialist ` +
      `references these by id; they may add items but cannot rename yours. Omit slices this application ` +
      `does not have (a CLI has no ui).\n` +
      `3. notPartitioned: decisions you deliberately left out, and why.\n\n` +
      `Structured output only.`,
    { label: 'lead', phase: 'Lead', agentType: leadAgentType, schema: GF_LEAD_SCHEMA }
  )

  if (!gl || !Array.isArray(gl.decisions) || !gl.decisions.length) {
    log('WARNING: the lead returned nothing - no decisions, no design, no plan')
    return { exit: finish({ run: { partial: true, errors: ['lead returned no decisions'], counts: { decisions: 0 } } }) }
  }

  // Decisions: positional ids, dependsOn remapped through the rename. A dependsOn or a
  // criteria index the code cannot resolve is dropped and reported - never guessed.
  const decRename = new Map(gl.decisions.map((d, i) => [String(d.id || `D${i + 1}`), `D${i + 1}`]))
  const renamedDecisions = [...decRename.entries()].filter(([a, b]) => a !== b).map(([a, b]) => `${a}->${b}`)
  if (renamedDecisions.length) log(`Decisions renamed to positional ids: ${renamedDecisions.join(', ')}`)
  const decisions = gl.decisions.map((d, i) => {
    const id = `D${i + 1}`
    const dependsOn = []
    for (const x of d.dependsOn || []) {
      const to = decRename.get(String(x))
      if (to && to !== id) dependsOn.push(to)
      else if (!to) danglingRefs.push({ from: id, ref: String(x) })
    }
    const cites = []
    for (const c of d.cites || []) {
      const n = Number(c)
      if (Number.isInteger(n) && n >= 0 && n < criteriaList.length) cites.push(n)
      else danglingRefs.push({ from: id, ref: `criteria[${c}]` })
    }
    return { id, domain: GF_DOMAINS.includes(d.domain) ? d.domain : 'other', question: String(d.question || ''), options: [], recommendation: '', why: String(d.why || ''), dependsOn, cites, refs: [], status: 'proposed' }
  })
  if (decisions.length < 2) {
    log(`WARNING: the lead wrote ${decisions.length} decision - one specialist is not a graph. Use /plan.`)
    return { exit: finish({ run: { partial: true, errors: ['fewer than two decisions'], counts: { decisions: decisions.length } }, lead: leadOut(gl, []), decisions, danglingRefs }) }
  }

  // The skeleton: positional ids per slice, whatever the lead wrote.
  const contract = {}
  for (const slice of Object.keys(SLICE_LETTER)) {
    const items = gl.contract && Array.isArray(gl.contract[slice]) ? gl.contract[slice] : []
    if (!items.length) continue
    const letter = SLICE_LETTER[slice]
    const renamed = items.map((it, i) => [String(it.id || ''), `${letter}${i + 1}`]).filter(([a, b]) => a && a !== b).map(([a, b]) => `${a}->${b}`)
    if (renamed.length) log(`${slice} skeleton renamed to positional ids: ${renamed.join(', ')}`)
    contract[slice] = items.map((it, i) => compact({ ...it, id: `${letter}${i + 1}` }))
  }

  const domains = [...new Set(decisions.map((d) => d.domain))]
  log(`Lead: ${decisions.length} decisions across ${domains.length} domain(s) - ${domains.map((d) => `${d} (${specialistTypes[d]})`).join(', ')}; skeleton: ${Object.entries(contract).map(([s, xs]) => `${s} ${xs.length}`).join(', ') || 'none'}`)

  // -------------------------------------------------------------------------
  // MERGE - plain code. A specialist's output lands in the shared state through this
  // and nothing else: only its own decisions, only the slices it owns, skeleton ids
  // kept, new ids renumbered, and its own references remapped through the rename.
  // -------------------------------------------------------------------------

  const REF_FIELDS = ['reads', 'writes', 'usedBy', 'refs']
  const remapRefs = (obj, rename) => {
    for (const f of REF_FIELDS) if (Array.isArray(obj[f])) obj[f] = obj[f].map((r) => rename.get(String(r)) || String(r))
    if (Array.isArray(obj.columns)) for (const c of obj.columns) if (c && c.ref !== undefined) c.ref = rename.get(String(c.ref)) || String(c.ref)
  }
  const absorb = (dom, out, label) => {
    const rename = new Map()
    const written = []
    for (const [slice, items] of Object.entries(out.contract || {})) {
      if (!Array.isArray(items) || !items.length) continue
      if (SLICE_OWNER[slice] !== dom) { log(`${label}: wrote ${items.length} item(s) to the ${slice} slice, which ${SLICE_OWNER[slice] || 'nobody'} owns - discarded; the need belongs in a decision's refs`); continue }
      const letter = SLICE_LETTER[slice]
      const cur = contract[slice] || (contract[slice] = [])
      for (const it of items) {
        const given = String(it.id || '')
        let target = cur.find((x) => x.id === given)
        if (!target) {
          const id = `${letter}${cur.length + 1}`
          if (given) rename.set(given, id)
          target = { id }
          cur.push(target)
          log(`${label}: new ${slice} item ${given || '(no id)'} -> ${id}`)
        }
        Object.assign(target, compact({ ...it, id: target.id }))
        written.push(target)
      }
    }
    const answered = []
    for (const d of out.decisions || []) {
      const target = decisions.find((x) => x.id === String(d.id))
      if (!target) { log(`${label}: decision ${d.id} is not in the lead's list - ignored`); continue }
      if (target.domain !== dom) { log(`${label}: decision ${d.id} belongs to ${target.domain} - ignored`); continue }
      Object.assign(target, {
        options: (d.options || []).map((o) => ({ name: String(o.name || ''), tradeoffs: String(o.tradeoffs || '') })),
        recommendation: String(d.recommendation || ''), why: String(d.why || ''),
        cites: (d.cites || []).map(Number), refs: (d.refs || []).map(String), status: 'proposed',
      })
      delete target.conflict
      answered.push(target)
    }
    if (rename.size) { for (const it of written) remapRefs(it, rename); for (const d of answered) remapRefs(d, rename) }
  }
  // Referential integrity, in code, at every fan-in: a reference to an id that does not
  // exist is removed from the object and reported. Never guessed, never left to a model.
  const integrity = () => {
    const ids = new Set([...decisions.map((d) => d.id), ...Object.values(contract).flat().map((it) => it.id)])
    const check = (from, obj) => {
      for (const f of REF_FIELDS) if (Array.isArray(obj[f])) obj[f] = obj[f].filter((r) => { const ok = ids.has(String(r)); if (!ok) danglingRefs.push({ from, ref: String(r) }); return ok })
      if (Array.isArray(obj.columns)) for (const c of obj.columns) if (c && c.ref !== undefined && !ids.has(String(c.ref))) { danglingRefs.push({ from, ref: String(c.ref) }); delete c.ref }
    }
    for (const d of decisions) {
      check(d.id, d)
      d.cites = d.cites.filter((n) => { const ok = Number.isInteger(n) && n >= 0 && n < criteriaList.length; if (!ok) danglingRefs.push({ from: d.id, ref: `criteria[${n}]` }); return ok })
    }
    for (const items of Object.values(contract)) for (const it of items) check(it.id, it)
  }

  // -------------------------------------------------------------------------
  // LAYER G1 - DESIGN. One specialist per domain, in parallel, fresh context each: its
  // decisions, the whole skeleton, nothing from the other specialists.
  // -------------------------------------------------------------------------

  phase('Design')
  const skeletonBlock = () => Object.entries(contract).map(([slice, items]) => `### ${slice} (owner: ${SLICE_OWNER[slice]})\n${items.map((it) => `[${it.id}] ${compact({ ...it, id: undefined }).method || ''} ${it.path || it.name || ''} - ${it.purpose || ''}`.replace(/\s+/g, ' ').trim()).join('\n')}`).join('\n')
  const DESIGN_PROMPT = (dom) => {
    const mine = decisions.filter((d) => d.domain === dom)
    const owned = Object.keys(SLICE_OWNER).filter((s) => SLICE_OWNER[s] === dom)
    const depText = (d) => d.dependsOn.map((x) => { const o = decisions.find((y) => y.id === x); return o ? `${x} (${o.domain}: ${o.question})` : x }).join('; ')
    return `You are the ${dom.toUpperCase()} SPECIALIST in a planning graph in GREENFIELD mode. You answer the ` +
      `decisions in your domain and elaborate your slice of the shared contract. You cannot see the ` +
      `other specialists; you see the lead's skeleton, which everyone names against.\n\n` +
      BRIEF_BLOCK() +
      `${WHERE}\n\n` +
      `## Your decisions\n${mine.map((d) => `- ${d.id}: ${d.question}\n    why it matters: ${d.why}\n    serves criteria: ${d.cites.map((i) => `[${i}]`).join(' ') || '-'}${d.dependsOn.length ? `\n    cannot be answered without: ${depText(d)}` : ''}`).join('\n')}\n\n` +
      `## The contract skeleton (ids are the vocabulary - reference by id)\n${skeletonBlock() || '(the lead declared no contract items)'}\n\n` +
      `## Rules\n` +
      `- For each of your decisions: the options with tradeoffs, ONE recommendation stated as the ` +
      `decision, why, cites (the criteria indexes it serves), refs (the contract ids it rests on). A ` +
      `recommendation that cites nothing and refs nothing is escalated to a human - anchor it.\n` +
      `- Contract: you OWN exactly these slices: ${owned.join(', ') || 'none'}. ` +
      (owned.length
        ? `Return them COMPLETE: elaborate every skeleton item there (keep its id) with full detail, and add ` +
          `items the brief needs (give each an id in the slice's letter; the code renumbers). Reference ` +
          `other slices by their skeleton ids only. Anything you write to a slice you do not own is ` +
          `discarded - put the need in a decision's refs instead.\n`
        : `Return contract as an empty object; put every need you have of another slice in a decision's refs.\n`) +
      `- Endpoint: method, path, auth (none | session), request and response shapes, errors, reads and ` +
      `writes (table ids). Table: columns {name, type, nullable, ref (table id)}, indexes. Route: ` +
      `components, reads and writes (endpoint ids). Type: shape, usedBy (endpoint and route ids).\n` +
      `- Decide from the brief and the constraints. What you cannot decide from them goes in notes, not ` +
      `in a guess.\n\n` +
      `Structured output only.`
  }

  const designs = await parallel(domains.map((dom) => () =>
    agent(DESIGN_PROMPT(dom), { label: `design:${dom}`, phase: 'Design', agentType: specialistTypes[dom], schema: DESIGN_SCHEMA })
  ))

  // Fan-in guard. A missing specialist is not a specialist with no decisions - its
  // decisions are unanswered and go to the human, and the run is partial.
  const deadSpecialists = domains.filter((_, i) => !designs[i])
  if (deadSpecialists.length) {
    partial = true
    errors.push(`${deadSpecialists.length} of ${domains.length} specialists returned nothing: ${deadSpecialists.join(', ')}`)
    log(`WARNING: ${deadSpecialists.length} of ${domains.length} specialists returned nothing (${deadSpecialists.join(', ')}) - their decisions go to the human - THIS PLAN IS PARTIAL`)
  }
  designs.forEach((out, i) => { if (out) absorb(domains[i], out, `design:${domains[i]}`) })
  integrity()
  const itemCount = () => Object.values(contract).reduce((n, xs) => n + xs.length, 0)
  log(`Design: ${domains.length - deadSpecialists.length} of ${domains.length} specialists returned; ${itemCount()} contract item(s); ${danglingRefs.length} dangling reference(s) removed`)

  // -------------------------------------------------------------------------
  // LAYER G2 - VALIDATE and REPAIR. One fresh validator per round sees the decisions
  // and the contract as DATA - never the specialist's reasoning, never the specialist -
  // and names each conflict with the owner that must fix it. Each owner gets exactly
  // its conflicts, returns its complete slice, and the code merges it the same way.
  // Bounded: MAX_REPAIR_ROUNDS, then the human decides. No verdict = unvalidated,
  // never validated.
  // -------------------------------------------------------------------------

  const decisionsData = () => decisions.map((d) => ({ id: d.id, domain: d.domain, question: d.question, recommendation: d.recommendation, cites: d.cites, refs: d.refs, status: d.status }))
  const VALIDATE_PROMPT = () =>
    `You are the CONSISTENCY VALIDATOR of a planning graph in GREENFIELD mode. Specialists you will never ` +
      `meet answered the decisions and elaborated the shared contract in parallel, each blind to the ` +
      `others. You see what they produced, as data - not their reasoning. Find where the parts disagree.\n\n` +
      BRIEF_BLOCK() +
      `## Decisions\n${JSON.stringify(decisionsData(), null, 1)}\n\n` +
      `## Contract\n${JSON.stringify(contract, null, 1)}\n\n` +
      `## Checks\n` +
      `1. Cross-slice agreement: a route's reads/writes name endpoints whose response carries what the ` +
      `route needs; an endpoint's reads/writes name tables whose columns carry what it returns or ` +
      `stores; an endpoint's auth agrees with the auth decisions; a shared type matches its usedBy.\n` +
      `2. Decision agreement: two recommendations that cannot both hold.\n` +
      `3. Coverage: an acceptance criterion no decision and no contract item serves -> uncovered.\n\n` +
      `Report only conflicts you can point at: the id that is wrong, the owner that must fix it (the ` +
      `slice owner - data / api / ui, types -> api - or the decision's domain), the two things that ` +
      `cannot both hold, the smallest fix. Do not restate reasoning. Do not invent problems: an empty ` +
      `conflicts list is a valid verdict.\n\n` +
      `Structured output only.`
  const REPAIR_PROMPT = (dom, mine) => {
    const owned = Object.keys(SLICE_OWNER).filter((s) => SLICE_OWNER[s] === dom)
    const slices = Object.fromEntries(owned.filter((s) => contract[s]).map((s) => [s, contract[s]]))
    return `You are the ${dom.toUpperCase()} SPECIALIST in a planning graph in GREENFIELD mode, repairing. A ` +
      `validator you will never meet found these conflicts in what you own:\n` +
      mine.map((c) => `- ${c.id}: ${c.problem}\n    suggested fix: ${c.fix}`).join('\n') + `\n\n` +
      BRIEF_BLOCK() +
      `## Your decisions, as merged\n${JSON.stringify(decisions.filter((d) => d.domain === dom).map((d) => ({ id: d.id, question: d.question, options: d.options, recommendation: d.recommendation, why: d.why, cites: d.cites, refs: d.refs })), null, 1)}\n\n` +
      `## Your contract slices, as merged (ids are final - keep them)\n${JSON.stringify(slices, null, 1)}\n\n` +
      `## The rest of the contract (reference only)\n${skeletonBlock()}\n\n` +
      `Return your COMPLETE decisions and slices under the same schema - everything, not just the ` +
      `changed parts. Fix only what the conflicts name; keep every id. If a conflict cannot be resolved ` +
      `within your slice, leave it and say why in notes.\n\n` +
      `Structured output only.`
  }

  let validatorCalls = 0
  let repairAttempts = 0
  let repaired = 0
  const validateOnce = async () => {
    validatorCalls++
    return agent(VALIDATE_PROMPT(), { label: `validate:${validatorCalls}`, phase: 'Validate', agentType: validatorAgentType, schema: CONSISTENCY_SCHEMA })
  }
  phase('Validate')
  let verdict = await validateOnce()
  let conflicts = verdict && Array.isArray(verdict.conflicts) ? verdict.conflicts : null
  const conflictsFound = conflicts ? conflicts.length : 0
  let uncovered = verdict && Array.isArray(verdict.uncovered) ? verdict.uncovered : []
  if (conflicts) log(`Validate: ${conflicts.length} conflict(s), ${uncovered.length} uncovered criteria`)
  for (let round = 1; conflicts && conflicts.length && round <= MAX_REPAIR_ROUNDS; round++) {
    phase('Repair')
    const owners = [...new Set(conflicts.map((c) => c.owner))].filter((o) => domains.includes(o))
    const orphan = conflicts.filter((c) => !domains.includes(c.owner))
    if (orphan.length) log(`${orphan.length} conflict(s) name an owner with no specialist (${[...new Set(orphan.map((c) => c.owner))].join(', ')}) - they go to the human`)
    if (!owners.length) break
    log(`Repair round ${round}: ${conflicts.length} conflict(s) -> ${owners.join(', ')}`)
    repairAttempts += owners.length
    const repairs = await parallel(owners.map((o) => () =>
      agent(REPAIR_PROMPT(o, conflicts.filter((c) => c.owner === o)), { label: `repair:${o}`, phase: 'Repair', agentType: specialistTypes[o], schema: DESIGN_SCHEMA })
    ))
    repairs.forEach((out, i) => {
      if (out) { absorb(owners[i], out, `repair:${owners[i]}`); repaired++ }
      else { errors.push(`repair:${owners[i]} returned nothing`); partial = true }
    })
    integrity()
    phase('Validate')
    verdict = await validateOnce()
    conflicts = verdict && Array.isArray(verdict.conflicts) ? verdict.conflicts : null
    // Uncovered criteria are never sent to an owner - nothing repairs them - so a gap
    // found in any round stays reported. Union, never the last word.
    if (verdict && Array.isArray(verdict.uncovered)) uncovered = [...new Set([...uncovered, ...verdict.uncovered])]
    if (conflicts) log(`Validate: ${conflicts.length} conflict(s) remain`)
  }

  // Settle. Three outcomes and a human: no verdict -> proposed (never promoted); a dead
  // specialist, an unanchored answer, or a conflict that survived repair -> human.
  const escalations = []
  if (conflicts === null) { errors.push('validator returned nothing - decisions are unvalidated'); partial = true; log('WARNING: the validator returned nothing - decisions stay proposed; nothing is validated by silence') }
  const conflictById = new Map((conflicts || []).map((c) => [String(c.id), c]))
  for (const d of decisions) {
    if (deadSpecialists.includes(d.domain)) { d.status = 'human'; d.conflict = 'specialist returned nothing' }
    else if (!d.recommendation) { d.status = 'human'; d.conflict = 'specialist returned no answer for this decision' }
    else if (!d.cites.length && !d.refs.length) { d.status = 'human'; d.conflict = 'unanchored: cites no criterion and refs no contract item' }
    else if (conflicts === null) d.status = 'proposed'
    else if (conflictById.has(d.id)) { const c = conflictById.get(d.id); d.status = 'human'; d.conflict = `${c.problem}${c.fix ? ` - suggested: ${c.fix}` : ''}` }
    else d.status = 'validated'
    if (d.status === 'human') escalations.push({ question: `${d.id} (${d.domain}): ${d.question} - ${d.conflict}`, recommendation: d.recommendation || '(none)' })
  }
  for (const c of conflicts || []) if (!decisions.some((d) => d.id === String(c.id))) escalations.push({ question: `${c.id} (${c.owner}): ${c.problem}`, recommendation: c.fix || '(none)' })
  const uncoveredGaps = uncovered.map((i) => (criteriaList[i] !== undefined ? `criteria[${i}] is served by no decision and no contract item: ${criteriaList[i]}` : `criteria[${i}] reported uncovered, but there is no such criterion`))
  const escalated = decisions.filter((d) => d.status === 'human').length
  log(`Settle: ${decisions.filter((d) => d.status === 'validated').length} validated, ${escalated} to the human, ${decisions.filter((d) => d.status === 'proposed').length} unvalidated`)

  return {
    gl, decisions, contract, escalations, uncoveredGaps, danglingRefs, partial, errors,
    counts: {
      decisions: decisions.length, contractItems: itemCount(), specialists: domains.length, specialistsReturned: domains.length - deadSpecialists.length,
      conflictsFound, repaired, conflictsRemaining: conflicts ? conflicts.length : 0, escalated, validatorCalls,
      agentCalls: 1 + domains.length + validatorCalls + repairAttempts,
    },
  }
}

// ===========================================================================
// THE ROUTER - one conditional edge, on the mode the skill chose.
// ===========================================================================

let inv = null, gf = null
if (MODE === 'existing') { inv = await investigate(); if (inv.exit) return inv.exit }
else { gf = await design(); if (gf.exit) return gf.exit }
const errors = inv ? inv.errors : gf.errors
let partial = inv ? inv.partial : gf.partial
const danglingRefs = gf ? gf.danglingRefs : []

// ---------------------------------------------------------------------------
// LAYER 4 - SYNTHESIZE. One strong agent designs, once, from verified facts (or
// validated decisions and the shared contract).
// Kim et al.: the centralized synthesizer is the "validation bottleneck" that contains
// errors (4.4x vs 17.2x). The hidden-profile result: a group of agents loses private
// facts to premature consensus; one agent holding all the facts does not. So the facts
// are gathered wide and the design is made in ONE context.
// ---------------------------------------------------------------------------

phase('Synthesize')
let synthPrompt
if (inv) {
  const { confirmed, refuted, unverifiedInfra, pastCap, lead } = inv
  const fmt = (f, tag) =>
    `[${f.id}]${tag ? ` (${tag})` : ''} ${f.claim}\n` +
    `    ${f.file}:${f.line} - ${f.kind}/${f.importance}/${f.confidence} - from ${f.agreedBy.join('+')}${f.outOfScope ? ' (out of that brief\'s scope)' : ''}\n` +
    `    quote: ${JSON.stringify(String(f.quote).slice(0, 200))}` +
    (f.why ? `\n    why: ${f.why}` : '')
  const confirmedBlock = confirmed.map((f) => fmt(f)).join('\n')
  const pastCapBlock = pastCap.map((f) => fmt(f, 'UNVERIFIED - past the verify cap')).join('\n')
  const infraBlock = unverifiedInfra.map((f) => fmt(f, 'UNVERIFIED - refuter failed')).join('\n')
  const refutedBlock = refuted.map((f) => `[${f.id}] ${f.claim}\n    REFUTED: ${f.correction || f.evidence}`).join('\n')
  synthPrompt =
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
    `3. Phases with commit boundaries. Each phase lists the files it writes (repo-relative, real), ` +
    `dependsOn: only phases whose ARTIFACT it consumes - not "should come after" - and refs: the finding ` +
    `ids [Fn] it rests on. Two phases that write the same file need an order; say which and why. Keep ` +
    `the mock registrations, migrations and the flag with the code that needs them - an intermediate ` +
    `commit must build.\n` +
    `4. decisions: product or money-scope questions a human must answer before code, each with your ` +
    `recommendation and why. Mark moneyScope on every phase that places orders or touches charges, fees, ` +
    `payouts, balances or wallets.\n` +
    `5. risks with mitigations, each tied to finding ids in refs.\n` +
    `6. gaps: facts you needed and did not get. Name them; never guess them.\n` +
    `7. plan: the full markdown, in the /plan output format (Contributing findings, Architectural ` +
    `decisions, Acceptance criteria, Implementation phases, Cross-domain dependencies, Risks). Cite ` +
    `[Fn] throughout so a reader can trace every claim to its anchor.\n\n` +
    `Structured output only.`
} else {
  const { decisions, contract, gl, uncoveredGaps } = gf
  const decisionsBlock = decisions.map((d) =>
    `[${d.id}] (${d.domain}, ${d.status.toUpperCase()}) ${d.question}\n` +
    `    -> ${d.recommendation || '(unanswered)'}${d.why ? `\n    why: ${d.why}` : ''}\n` +
    `    serves criteria: ${d.cites.map((i) => `[${i}]`).join(' ') || '-'}; refs: ${d.refs.join(', ') || '-'}` +
    (d.conflict ? `\n    HUMAN DECIDES: ${d.conflict}` : '')
  ).join('\n')
  const contractBlock = Object.entries(contract).map(([slice, items]) => `### ${slice}\n${items.map((it) => `[${it.id}] ${JSON.stringify(compact({ ...it, id: undefined }))}`).join('\n')}`).join('\n')
  synthPrompt =
    `You are the SYNTHESIZER of a planning graph in GREENFIELD mode. There is no code yet. The graph ` +
    `extracted the decisions this brief forces, had one specialist per domain answer them against a ` +
    `shared contract, checked the contract for consistency, and repaired what it could; what it could ` +
    `not is marked HUMAN DECIDES. You design the plan ONCE from that. You do not re-derive the ` +
    `decisions: a VALIDATED decision is decided - build on it; do not overturn it silently. If you ` +
    `must, say so in decisions, for the human. If a decision or a contract item you need is missing, ` +
    `name it in gaps.\n\n` +
    BRIEF_BLOCK() +
    `${WHERE}\n\n` +
    `## Decisions (${decisions.length})\n${decisionsBlock}\n\n` +
    `## The contract - the naming ground; every phase refs the ids it implements\n${contractBlock || '(none)'}\n\n` +
    (uncoveredGaps.length ? `## Criteria the validator found uncovered\n- ${uncoveredGaps.join('\n- ')}\n\n` : '') +
    (gl.notPartitioned && gl.notPartitioned.length ? `## Decisions the lead chose not to partition\n- ${gl.notPartitioned.join('\n- ')}\n\n` : '') +
    `## Instructions\n` +
    `1. Corrections to the briefing first: where the decisions or the contract contradict the ` +
    `requirements or the acceptance criteria, say so, citing ids.\n` +
    `2. Design: the unified approach, from the validated decisions and the contract. Where a HUMAN ` +
    `DECIDES item blocks a phase, plan around it and say which phase waits on it.\n` +
    `3. Phases with commit boundaries. The first phase of a greenfield plan is the scaffold - repo ` +
    `layout, tooling, the dev and type-check commands from the constraints - and it must build. Each ` +
    `phase lists the files it writes (repo-relative, real), dependsOn: only phases whose ARTIFACT it ` +
    `consumes - not "should come after" - and refs: the ids it implements or rests on ([Dn] [En] [Tn] ` +
    `[Rn] [Yn]); a phase that creates an endpoint refs it, a phase that creates a table refs it. Two ` +
    `phases that write the same file need an order; say which and why. An intermediate commit must build.\n` +
    `4. decisions: product questions a human must answer before code, each with your recommendation ` +
    `and why. Mark moneyScope on every phase that touches charges, fees, payouts, balances or wallets.\n` +
    `5. risks with mitigations, each tied to ids in refs.\n` +
    `6. gaps: decisions or contract items you needed and did not get. Name them; never guess them.\n` +
    `7. plan: the full markdown, in the /plan output format (Contributing decisions, Architectural ` +
    `decisions, Acceptance criteria, Implementation phases, Cross-domain dependencies, Risks). Cite ids ` +
    `throughout so a reader can trace every phase to the decision and contract item it implements.\n\n` +
    `Structured output only.`
}

const synth = await agent(synthPrompt, { label: 'synthesize', phase: 'Synthesize', agentType: synthAgentType, schema: PLAN_SCHEMA })

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

// Phase ids are the vocabulary too: P1.. in the synthesizer's order, with dependsOn
// remapped through the rename. A dependsOn the remap cannot resolve keeps its original
// name and is reported as dangling below - never guessed.
const synthPhases = synth && Array.isArray(synth.phases) ? synth.phases : []
const phaseRename = new Map(synthPhases.map((p, i) => [String(p.id || `P${i + 1}`), `P${i + 1}`]))
const renamedPhases = [...phaseRename.entries()].filter(([from, to]) => from !== to).map(([from, to]) => `${from}->${to}`)
if (renamedPhases.length) log(`Phases renamed to positional ids: ${renamedPhases.join(', ')}`)
// The id universe every phase or risk ref must land in: facts, decisions, contract items.
const idUniverse = new Set([
  ...(inv ? [...inv.confirmed, ...inv.refuted, ...inv.unverifiedInfra, ...inv.pastCap].map((f) => f.id) : []),
  ...(gf ? [...gf.decisions.map((d) => d.id), ...Object.values(gf.contract).flat().map((it) => it.id)] : []),
])
const keepRefs = (from, refs) => (Array.isArray(refs) ? refs : []).map(String).filter((r) => { const ok = idUniverse.has(r); if (!ok) danglingRefs.push({ from, ref: r }); return ok })
const danglingDeps = []
const phases = synthPhases.map((p, i) => {
  const id = `P${i + 1}`
  const dependsOn = []
  for (const d of p.dependsOn || []) {
    const to = phaseRename.get(String(d))
    if (to) dependsOn.push(to)
    else danglingDeps.push({ phase: id, dependsOn: String(d) })
  }
  return {
    id, uid: id, title: String(p.title || ''), commit: String(p.commit || ''), files: (p.files || []).map(normPath), dependsOn,
    owner: String(p.owner || ''), moneyScope: p.moneyScope, refs: keepRefs(id, p.refs), notes: p.notes,
  }
})
let edges = []
for (const p of phases) {
  for (const d of p.dependsOn) {
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
const risks = synth ? (synth.risks || []).map((r, i) => compact({ ...r, refs: keepRefs(`risk[${i}]`, r.refs) })) : []
const allDangling = dedupeRefs(danglingRefs)
if (allDangling.length) log(`${allDangling.length} dangling reference(s) removed and reported: ${allDangling.slice(0, 8).map((r) => `${r.from}->${r.ref}`).join(', ')}${allDangling.length > 8 ? ', ...' : ''}`)

if (!synth) errors.push('synthesizer returned nothing')
partial = partial || !synth

const counts = {
  ...(inv ? inv.counts : gf.counts),
  phases: phases.length, declaredEdges: edges.filter((e) => e.reason === 'declared').length, sharedFileEdgesAdded: sharedFileEdgesAdded.length, unbackedEdges: unbackedEdges.length, danglingRefs: allDangling.length,
  agentCalls: (inv ? inv.counts : gf.counts).agentCalls + 1,
}
const common = {
  run: { partial, errors, counts },
  plan: synth ? String(synth.plan || '') : '',
  phases: phases.map(({ uid, ...p }) => compact(p)),
  edges,
  layers: layered.layers,
  sharedFileEdgesAdded,
  unbackedEdges,
  danglingDeps,
  danglingRefs: allDangling,
  risks,
  outOfScope: synth ? synth.outOfScope || [] : [],
}
if (inv) {
  return finish({
    ...common,
    lead: leadOut(inv.lead, inv.overlaps),
    briefs: briefsOut(inv.briefs, inv.invRaw),
    facts: [
      ...inv.confirmed.map((f) => compact(f)),
      ...inv.refuted.map((f) => compact(f)),
      ...inv.unverifiedInfra.map((f) => compact(f)),
      ...inv.pastCap.map((f) => compact({ ...f, status: 'past-cap' })),
    ],
    gaps: synth ? synth.gaps || [] : [],
    humanDecisions: synth ? (synth.decisions || []).map((d) => compact(d)) : [],
  })
}
return finish({
  ...common,
  lead: leadOut(gf.gl, []),
  decisions: gf.decisions.map((d) => compact(d)),
  contract: gf.contract,
  gaps: [...gf.uncoveredGaps, ...(synth ? synth.gaps || [] : [])],
  humanDecisions: [...gf.escalations, ...(synth ? (synth.decisions || []).map((d) => compact(d)) : [])],
})
