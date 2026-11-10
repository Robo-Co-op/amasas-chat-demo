# AGENTS.md - amasas-chat-demo

> Adapter file. Copy this into the root of a Robo Co-op repository and fill in the blanks.
> It tells any agent (Claude Code, Codex, Copilot) which rules this repository runs under.
> It does not restate the rules - it links to them.
>
> Delete the sections that do not apply, but **do not delete `## OS Exceptions` by leaving it
> empty when it is not**. An unwritten deviation is the thing this file exists to prevent.

## Operating system

This repository follows **Robo Builder OS v0.1.x**
(`Robo-Co-op/robobuilder-os`: [`DEVELOPMENT_OS.md`](https://github.com/Robo-Co-op/robobuilder-os/blob/main/DEVELOPMENT_OS.md),
[`schemas/lifecycle.yaml`](https://github.com/Robo-Co-op/robobuilder-os/blob/main/schemas/lifecycle.yaml)).

Before acting, establish which lifecycle state this work is in, and do only what that state allows:

```
DEFINE -> DESIGN -> ISSUE -> BRANCH -> TEST -> BUILD -> REVIEW -> STAGE -> DEPLOY -> VERIFY -> OPERATE
```

If a request would skip a state, say so and take the exception path (DEVELOPMENT_OS.md section 6)
rather than skipping silently.

Gates that apply here:

- [Definition of Ready](https://github.com/Robo-Co-op/robobuilder-os/blob/main/gates/definition-of-ready.md) - before starting a branch
- [Merge Gate](https://github.com/Robo-Co-op/robobuilder-os/blob/main/gates/merge-gate.md) - before merging
- [Production Gate](https://github.com/Robo-Co-op/robobuilder-os/blob/main/gates/production-gate.md) - before deploying
- [Definition of Done](https://github.com/Robo-Co-op/robobuilder-os/blob/main/gates/definition-of-done.md) - before closing an issue

<!-- Pick the line that is true here, delete the others:

  - Full spine. All eleven states run as written.

  - **Merging to `main` IS deploying to production.** The Merge Gate and the Production Gate must
    therefore both be satisfied before the merge button, not after it. (See exception 1.)

  - Documentation-only repository. STAGE / DEPLOY / VERIFY collapse into "merged to `main` and
    announced to repository owners". The Production Gate does not apply.
-->

## Toolbox

Robo Builder edition used here: **<Lite | Standard | Pro - to be filed>**
Coding standards: `robobuilder-standard/CLAUDE.md.baseline`.

## Project facts

| | |
|---|---|
| Product owner | to be filed |
| Tech lead | to be filed |
| Default risk level | <low / medium / high / critical> - to be filed |
| Production approvers | to be filed |
| Stack | to be filed |
| Environments | to be filed |
| Deploy path | to be filed |
| Secrets live in | to be filed |
| Visibility | Public |

## Known traps

Facts an agent would otherwise learn the hard way. Not rules - hazards. Keep this short and
specific; each entry should have cost someone real time at least once.

- to be filed

## Repository-specific rules

Rules this repository **adds** on top of the OS. Deviations *from* the OS go in the next section.

- to be filed

## OS Exceptions

Recorded deviations, per DEVELOPMENT_OS.md section 6. Each one is a gap to close, not a licence.
Adopting the OS on an existing repository usually surfaces several at once - write them all down
in the adoption PR, then file the follow-ups. `to be filed` is an acceptable temporary value; a
missing section is not.

### 1. <short title>

- **Rule skipped:** <the hard rule or gate item, named exactly>
- **What actually happens:** <the real behaviour, with the file or step that causes it>
- **Risk exposed:** <what can go wrong, and how it would be noticed>
- **Compensating control:** <what partially covers it today, or "none">
- **Accepted by:** <a named person>, <date>
- **Follow-up:** <#NN, or "to be filed">

## Restricted paths

Changes under these paths are **high risk** and need the named owner's review:

- to be filed

## Never, in this repository

- Push to `main`.
- Touch production data or the production database by hand.
- Commit secrets, `.env` files, customer exports or production data.
- Present a fabricated number as real data.
- <project-specific hard rule>
