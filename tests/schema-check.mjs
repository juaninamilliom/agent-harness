// Minimal JSON Schema validator for the harness's own schemas (plugins/harness/schemas/).
// The repo has no npm dependencies, so this implements exactly the subset those schemas
// use - and THROWS on any keyword it does not implement, so a schema can never silently
// rely on a feature this checker ignores. Grow the subset deliberately, here, when a
// schema needs it.
//   import { validate } from './schema-check.mjs'
//   const errors = validate(schema, value)   // [] when valid; one "path: reason" string per violation
const KNOWN = new Set(['$schema', '$id', 'title', 'description', 'type', 'properties', 'required', 'additionalProperties', 'items', 'enum', 'const', '$ref', '$defs', 'minItems', 'pattern', 'anyOf'])

const typeOf = (v) => v === null ? 'null' : Array.isArray(v) ? 'array' : (typeof v === 'number' && Number.isInteger(v)) ? 'integer' : typeof v

export function validate(schema, value) {
  const root = schema
  const walk = (s, v, p) => {
    for (const k of Object.keys(s)) if (!KNOWN.has(k)) throw new Error(`schema-check: unsupported keyword "${k}" at ${p} - add it to KNOWN and implement it, or rewrite the schema`)
    if (s.$ref) {
      const m = /^#\/\$defs\/([^/]+)$/.exec(s.$ref)
      if (!m || !root.$defs || !root.$defs[m[1]]) throw new Error(`schema-check: unresolvable $ref ${s.$ref} at ${p} (only #/$defs/<name> is supported)`)
      return walk(root.$defs[m[1]], v, p)
    }
    const errs = []
    if (s.anyOf) {
      const attempts = s.anyOf.map((alt) => walk(alt, v, p))
      if (!attempts.some((e) => e.length === 0)) errs.push(`${p}: matches none of anyOf (${attempts.map((e) => e[0]).join(' | ')})`)
      return errs
    }
    if (s.const !== undefined && JSON.stringify(v) !== JSON.stringify(s.const)) errs.push(`${p}: expected const ${JSON.stringify(s.const)}, got ${JSON.stringify(v)}`)
    if (s.enum && !s.enum.some((e) => JSON.stringify(e) === JSON.stringify(v))) errs.push(`${p}: ${JSON.stringify(v)} not in [${s.enum.map((e) => JSON.stringify(e)).join(', ')}]`)
    if (s.type) {
      const types = Array.isArray(s.type) ? s.type : [s.type]
      const actual = typeOf(v)
      if (!types.some((t) => t === actual || (t === 'number' && actual === 'integer'))) { errs.push(`${p}: expected ${types.join('|')}, got ${actual}`); return errs }
    }
    if (s.pattern && typeof v === 'string' && !new RegExp(s.pattern).test(v)) errs.push(`${p}: "${v}" does not match /${s.pattern}/`)
    if (Array.isArray(v)) {
      if (s.minItems !== undefined && v.length < s.minItems) errs.push(`${p}: expected at least ${s.minItems} item(s), got ${v.length}`)
      if (s.items) v.forEach((item, i) => errs.push(...walk(s.items, item, `${p}[${i}]`)))
    } else if (v && typeof v === 'object') {
      for (const r of s.required || []) if (!(r in v)) errs.push(`${p}: missing required "${r}"`)
      for (const [k, val] of Object.entries(v)) {
        if (s.properties && Object.prototype.hasOwnProperty.call(s.properties, k)) errs.push(...walk(s.properties[k], val, `${p}.${k}`))
        else if (s.additionalProperties === false) errs.push(`${p}: unexpected property "${k}"`)
        else if (s.additionalProperties && typeof s.additionalProperties === 'object') errs.push(...walk(s.additionalProperties, val, `${p}.${k}`))
      }
    }
    return errs
  }
  return walk(schema, value, '$')
}
