# LESSONS - auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Plan/Checks)

Corroborated across multiple features. Safe to apply as guidance.

_none_

## Candidates (under observation - do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 - A range bound (min period, min size) needs a test on the far side of the bound, not only inside it: below the minimum, detection must fail, not return a multiple.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `core` · harmful: 0
- features: mesa-mvp
- evidence: MAP-04 / src/core/grid-detect.ts (core)
- last seen: 2026-11-09T13:58:56Z

### L-002 - A criterion that names a screen element (message plus button) is proven by an e2e that drives the state and clicks the control, not by asserting the client status.
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `e2e` · harmful: 0
- features: mesa-mvp
- evidence: C12 / NET-12 (e2e)
- last seen: 2026-11-09T13:58:56Z

### L-003 - Every input mode a criterion lists (middle button and Space) gets its own test, and modifier-key gestures must be excluded from the other tools' handlers.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `renderer` · harmful: 0
- features: mesa-mvp
- evidence: MAP-08 / src/renderer/board/overlays.ts (renderer)
- last seen: 2026-11-09T13:58:56Z

### L-004 - State whether a numeric limit applies per item or to the total (e.g. modifier = sum of constants) when writing the criterion.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `spec` · harmful: 0
- features: mesa-mvp
- evidence: DICE-04 (spec)
- last seen: 2026-11-09T13:58:56Z

### L-005 - Text length limits count characters ([...s].length), never UTF-16 units, and the tests include an emoji at the boundary.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `core` · harmful: 0
- features: mesa-mvp
- evidence: NET-07 / CHAT-02 (core)
- last seen: 2026-11-09T13:58:56Z

### L-006 - A value a third-party tool fills in (release name, artifact name) is asserted from the tool's own output or parser, not from our config, because the tool's default may differ from the spec.
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `build` · harmful: 0
- features: auto-update
- evidence: C20 / F1 (build)
- last seen: 2026-11-09T16:59:39Z

### L-007 - When test mode swaps a dependency, the line that chooses between real and fake gets its own test through the real wiring, or a wrong choice stays green in every test.
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `main` · harmful: 0
- features: auto-update
- evidence: C13 / F2 (main)
- last seen: 2026-11-09T16:59:39Z

### L-008 - A claim about 'every' item (all commits, all rows) is proven against the full source list, never by sampling two members.
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `repo` · harmful: 0
- features: auto-update
- evidence: C25 / F3 (repo)
- last seen: 2026-11-09T16:59:39Z

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
