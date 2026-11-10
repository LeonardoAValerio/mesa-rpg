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

### L-009 - A CI step's arguments are tested with the shell that runs them (pwsh on Windows runners drops '--' and does not expand $VAR), and a publish step is tested against the tool's behaviour when nothing exists yet.
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `ci` · harmful: 0
- features: auto-update
- evidence: C20 / v0.2.0 release (ci)
- last seen: 2026-11-09T17:20:00Z

### L-010 - A rule about 'any' element is tested with the hit at the first, a middle and the last position, so a check of only one position fails.
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `core` · harmful: 0
- features: fog-default
- evidence: C5 / F1 (core)
- last seen: 2026-11-09T18:10:56Z

### L-011 - A wire schema's size cap sits above the domain limit, so the domain's refusal message is reachable; test the limit through the parser, not only the reducer.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `protocol` · harmful: 0
- features: fog-shapes
- evidence: F1 / FOGS-08 (protocol)
- last seen: 2026-11-09T21:16:27Z

### L-012 - Exercise a renderer at the spec's upper bound (here 2000 fog shapes): redrawing everything per change crashed the window; draw only what was added.
- signal: `gate_fail` · recurrence: 1 feature(s) · scope: `renderer` · harmful: 0
- features: fog-shapes
- evidence: F2 test / renderer crash (renderer)
- last seen: 2026-11-09T21:16:27Z

### L-013 - When the model and the drawing implement the same geometry, test the case where common implementations differ (a self-crossing polygon: even-odd vs nonzero).
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `renderer` · harmful: 0
- features: fog-shapes
- evidence: F3 / FOGS-03 (renderer)
- last seen: 2026-11-09T21:16:27Z

### L-014 - A test hook for something drawn measures the drawn geometry or pixels through the real transform, never the tool's own state.
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `e2e` · harmful: 0
- features: fog-shapes
- evidence: F4, F5, F6 (e2e)
- last seen: 2026-11-09T21:16:27Z

### L-015 - Position and draw order in a test hook come from the drawn objects (bounds, real child order), not from the container fields the code sets.
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `e2e` · harmful: 0
- features: tokens-objects
- evidence: F1, F2 (e2e)
- last seen: 2026-11-09T23:14:22Z

### L-016 - Every new pointer or key gesture states which tool and state it works in (select tool, no Space) and how it ends (empty click, Esc, tool change).
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `renderer` · harmful: 0
- features: tokens-objects
- evidence: F4, F5 (renderer)
- last seen: 2026-11-09T23:14:22Z

### L-017 - When an item can rotate, every geometric rule on it (snap, bounds, hit) uses the rotated box.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `core` · harmful: 0
- features: tokens-objects
- evidence: F6 (core)
- last seen: 2026-11-09T23:14:22Z

### L-018 - A test of 'kept separate' writes both sides and reads both back; a test of a filter feeds it a real, readable input it must reject.
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `e2e` · harmful: 0
- features: sidebar-tabs
- evidence: F1, F2 (e2e)
- last seen: 2026-11-10T00:50:09Z

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
