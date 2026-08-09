---
name: brainstorming
description: Use before creative implementation work such as creating or changing features, components, interfaces, content, or behavior.
---

# Brainstorming

## Scope and Complexity Gate

Before implementation, run a brief internal check. Proceed directly only when **all** are true **and none of the full-workflow triggers below apply**:

- **Clear:** Target, outcome, and constraints are explicit; no meaningful choice remains.
- **Local:** The surface is small and creates no cross-component contract.
- **Reversible and low-risk:** It is easy to undo and has no material security, billing, data, migration, compliance, public API, compatibility, or rollout risk.
- **Non-material:** It is copy, asset, style, configuration, or mechanical work—not a substantial behavior or workflow change.

If all are true, confirm the target, implement, and verify. Do **not** require questions, alternatives, a design document, approval loop, or `writing-plans`. Keep the check internal.

Use the full workflow if **any** of these apply:

- Ambiguity or meaningful product trade-offs
- Architectural, cross-component, or public-contract changes
- High risk or difficult rollback
- Material behavior, data, or workflow changes
- An explicit request to brainstorm, design, or specify

If uncertainty is a discoverable fact, such as a file location, inspect the project and reevaluate. Do not turn routine discovery into design.

## Existing Decisions and Approval

Treat an imperative, exact request as approval only of the decisions it states; never infer approval of unstated high-impact details. Reuse an approved design or specification, and never ask for the same approval twice.

## Decision Examples

| Proceed directly | Use full brainstorming |
|---|---|
| Change two specified labels in an existing social graphic, preserving everything else. | “Make onboarding better” without goals or success criteria. |
| Replace exact button copy in one component. | Replace authentication across web, API, and mobile clients. |
| Apply the same specified config-key change in two known files. | Add a billing flow, destructive migration, or new public API. |

Boundary checks:

- Multiple files can be simple when work is mechanical; one file can be complex when security, data, or core behavior changes.
- Exact wording does not make an irreversible or high-risk request simple.
- Content needs full brainstorming when its concept, audience, or visual direction is undecided.

## Full Workflow

1. Explore relevant files, docs, and recent changes.
2. Ask one question at a time about unresolved high-impact decisions.
3. Propose 2–3 approaches only when real alternatives exist.
4. Present a scaled design covering relevant architecture, data flow, failures, verification, and rollout.
5. Obtain only missing approval.
6. Write or update `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`, unless another location is required. Reuse approved specs.
7. Self-review for placeholders, contradictions, scope, and ambiguity.
8. Invoke `writing-plans` before implementation.

<HARD-GATE>
Do not implement work that fails the gate until its unresolved design is approved. This does not apply to work that passes every direct-work condition.
</HARD-GATE>

## Red Flags

- “The skill triggered, so a spec is mandatory.” Run the gate first.
- “Several files means architectural.” Judge contracts, risk, and behavior—not file count.
- “Leadership approved it, so details do not matter.” Resolve unapproved high-impact decisions.

If a design question is genuinely clearer visually, offer the visual companion just in time. Read [visual-companion.md](visual-companion.md) only if the user accepts. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for upstream licensing.
