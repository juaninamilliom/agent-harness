# Add-ons

The engine is integration-free by design (philosophy §5). Anything that
talks to an external system - a ticket tracker, a deploy platform, an
analytics stack - is an add-on that wraps the engine from the outside. Two
sanctioned shapes:

## a) A sibling plugin in this marketplace

`plugins/<addon>/` with its own skills. To extend an engine skill, ship an
UNNAMESPACED wrapper: a project (or the add-on's docs) defines a skill named
e.g. `plan` that does its integration work (fetch the ticket, resolve the
sprint) and then invokes `/harness:plan` with the gathered context. Bare
`/plan` wins for the user; the engine stays untouched.

## b) A scaffold overlay

Files stamped into a project's own `.claude/` (skills, agents, MCP config,
permissions for the integration's tools). The project owns them afterwards,
same as everything `scaffold/init.sh` stamps.

## Planned

- **Ticketing** (first): re-adds what the harness's ancestor had woven in -
  fetch ticket on /plan, ticket-ref in commit messages and PR titles,
  acceptance-criteria validation in review. One wrapper per tracker
  (trello, jira, linear, github-issues), each shape (a).

An add-on may add MCP servers and permission grants; it must not patch,
fork, or depend on the internals of engine skills - only on their names and
the project CLAUDE.md contract.
