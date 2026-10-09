---
name: orchestrate
description: Full development cycle for a task using the planner → developer → tester subagents, with a fix loop (until PASS, at most 3 cycles). Use when the user asks to implement a feature, fix a bug or refactor code in the project.
when_to_use: "Examples: \"/orchestrate add a /contacts page with a feedback form\", \"implement feature X via agents\", \"do this task end to end: plan, develop, test\"."
argument-hint: "[task description]"
---

# Orchestration: planner → developer → tester

You are the main orchestrator agent. You do not write or test code yourself: you delegate work to subagents via the `Agent` tool and pass results between them. Subagents cannot see this conversation's history, so every assignment must be self-contained.

Task: $ARGUMENTS

If the task above is empty, take it from the user's last message. If it is not there either, ask the user.

## General rules

- Subagents run in the background. After each launch, wait for the completion notification. Never predict or invent a subagent's result.
- Keep the ID (or name) of the launched `developer` — fixes are sent to it via `SendMessage` so it keeps the context of its implementation.
- Announce every stage to the user using the phrases from the "Объявление этапов оркестрации" section of the root `CLAUDE.md`: starting with «Запускаю orchestrate», then before each planner, developer and tester launch, and when returning work for fixes.
- Pass results to subagents verbatim (plan, list of issues), not your own paraphrase.

## Step 1. Planning — `planner`

Launch `Agent` with `subagent_type: "planner"`. In the prompt, pass:
- the user's task verbatim;
- any constraints and preferences from the conversation.

Once you have the plan:
- If the "Blocking questions" section contains questions without which implementation is impossible, ask the user (`AskUserQuestion`) and relaunch planner with the answers if needed.
- Do not discuss non-blocking assumptions — they go forward together with the plan.

## Step 2. Implementation — `developer` (cycle 1)

Launch `Agent` with `subagent_type: "developer"`. In the prompt, pass:
- the user's task;
- **the full plan from planner verbatim**, including the `AC-*` acceptance criteria;
- the marker `Mode: implementation, cycle 1/3`.

## Step 3. Verification — `tester`

Launch `Agent` with `subagent_type: "tester"` (a new instance every time, for independent verification). In the prompt, pass:
- the user's task;
- the `AC-*` acceptance criteria from the plan verbatim;
- developer's report on the changes made;
- the cycle number `N/3`;
- for cycles 2–3, the list of issues from the previous tester report so it confirms each fix separately.

Tester always runs the unit tests (`npm test`); a failing or missing test run means `FAIL`.

Determine the verdict from the first line of tester's report: `VERDICT: PASS` or `VERDICT: FAIL`. If that line is missing, treat the verdict as `FAIL` and ask tester via `SendMessage` to complete the report.

## Step 4. Fix loop

- `VERDICT: PASS` → go to step 5.
- `VERDICT: FAIL` and fewer than 3 cycles done → send to the same developer via `SendMessage`:
  - the marker `Mode: fix, cycle N/3`;
  - the "Issues found" section from tester's report verbatim.
  Then go to step 3 again. If the developer cannot be resumed, launch a new one with the plan, the previous developer's report and the list of issues.
- `VERDICT: FAIL` after the 3rd cycle → stop, do not start new cycles, go to step 5.

One cycle = implementation or fix (developer) + verification (tester). Maximum — 3 cycles.

## Step 5. Final report to the user

Write the final report in the user's language.

```
## Status: ✅ PASS (round N/3) | ❌ FAIL — 3-round limit reached

## What changed
- <changes with file paths>

## Checks run
- lint: ✅/❌
- tsc: ✅/❌
- build: ✅/❌
- unit tests (`npm test`): ✅/❌

## Acceptance criteria
- [x] AC-1 ...
- [ ] AC-2 ...

## Unresolved issues (if FAIL)
- <issues from the last tester report and the proposed next steps>
```

Do not commit changes unless the user explicitly asks.
