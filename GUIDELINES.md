# Agent working guidelines: AI Form Filler

## 0. The two instruction files

The project has two instruction files in its root folder:

- `TODO.md`: the task list. It holds all the requirements as a checkbox list, plus the suggested build order. It says WHAT to build.
- `GUIDELINES.md`: this file. It says HOW to work.

Read both fully before writing any code, and re-read this file at the start of every session.

**NEVER modify `GUIDELINES.md`. Not to tick things, not to add notes, not to fix typos, not to record decisions, not to reformat.** It is read-only for you, in every session and for every reason.

- If you think a guideline is wrong, unclear, or conflicts with `TODO.md`, tell the user in the chat and ask. Do not edit the file, and do not quietly ignore the rule.
- The only file you update to track progress in `TODO.md` is by ticking its checkboxes (see section 2). Do not otherwise rewrite, reorder or delete its requirements. If a requirement needs to change, ask the user first.
- Progress, decisions, open questions and notes go in the `README.md` Progress section, never in `GUIDELINES.md`.

## 1. Work one task at a time

Take the tasks from `TODO.md` in the order of its "Suggested build order" section. Do not skip ahead and do not work on several tasks in parallel.

- Before starting a task, say in one or two sentences which task you are starting and which sections of `TODO.md` it covers.
- A task is complete only when all of its requirements are satisfied. If part of a task cannot be done yet (for example because it depends on a later task), say so explicitly instead of calling it done.
- Do not add features, options, files or dependencies that are not in `TODO.md`. If you think something is missing, ask (see section 3) instead of adding it.
- Keep each task small enough to finish and verify. If a task turns out to be big, split it into sub-steps and track them the same way.

## 2. After every completed task, update the progress records

Do this immediately after finishing each task, before starting the next one. The goal is that if the work is interrupted at any moment, a fresh session can read the records and continue exactly where you stopped.

- Tick the checkboxes of the finished requirements in `TODO.md`. Only tick what is actually implemented and verified. Never tick items in advance.
- Update the **Progress** section at the top of `README.md` with:
  - The last completed task (name and number from the build order).
  - The next task to do.
  - A short list of what exists now and works (features available to the user).
  - Known limitations and anything left half-done, with the file names involved.
  - Decisions the user made (see section 3), each with a one-line reason.
  - Open questions still waiting for the user.
- Keep the rest of the README current as well: install steps, folder overview, file formats, and the manual checklist items that now apply.
- Verify the work before declaring it done (see section 4), and record how it was verified.
- If the project is under git, make one commit per completed task with a clear message (for example `Task 4: content script picker, panel, collector and filler`). Do not commit broken or half-finished work to the main line. If you must stop mid-task, note the exact state in the README Progress section under "In progress".

At the start of every session, including after an interruption, read `GUIDELINES.md`, `TODO.md` and the README Progress section. Check the actual code against them, then continue from the recorded next task. If the records and the code disagree, tell the user and ask before continuing.

## 3. Avoid assumptions. Ask when you cannot avoid them

First try to answer the question yourself from `TODO.md`, the README, the existing code and the platform documentation. Do not ask about things that are already decided in those places.

If something is ambiguous, missing or contradictory, and the answer would change the behavior, structure or security of the extension, STOP and ask the user before continuing. Do not guess and keep going.

Never silently pick a default for:

- Anything that touches the core invariants (never submit, never click without permission, no persisted data).
- Permissions in the manifest.
- New dependencies.
- The Manifest version.
- How content scripts share code.
- User-visible wording of warnings or permission prompts.

Small implementation details that do not change behavior (variable names, internal helper structure, CSS spacing) are yours to decide. Do not ask about those.

How to ask:

- Ask in the chat, one question at a time, and wait for the answer before continuing the affected work.
- State what you were trying to do, what is unclear, and the realistic options (2 to 3) with the consequences of each.
- Give your recommendation and why, so the user can answer with a single word.
- You may continue with other work that is not affected by the question while waiting.
- Record the answer in the README Progress section under "Decisions" so it is not asked again.

If the requirements contradict each other or are impossible on the platform (for example a Firefox API that does not exist), say so clearly and propose alternatives. Do not quietly work around it.

If you made an assumption anyway because there was truly no way to ask, list it prominently in your report and in the README so the user can correct it.

## 4. Verification and honesty

- Before finishing a task, check that every file loads without syntax errors, validate or load the extension (for example with `web-ext lint` or `web-ext run` if available) and exercise the new behavior as far as you can.
- Do not create test pages or a `tests/` folder (the user does not want them). Verify using real pages where possible, and add the relevant items to the README manual checklist for the user to run.
- Be honest about what you could not verify, for example behavior on a specific site, or a model you cannot reach. Say what is untested instead of claiming it works.
- If you find a bug in earlier work while doing a later task, fix it and note it in the README. If the fix changes behavior from `TODO.md`, ask first.
- If something in `TODO.md` seems risky or wrong, especially for security or privacy, raise it instead of implementing it silently.

## 5. Code quality rules (apply to every file, every task)

- Readable code: clear names, small functions that do one thing, no clever one-liners, no dead code or commented-out code.
- A comment before every function, class and non-trivial block explaining what it does and why. A short header comment at the top of each file stating its purpose.
- Short files (aim for under ~200 lines). When a file grows beyond that, split it into new files with a single responsibility.
- Files organized in folders by area, following the structure in `TODO.md`. Create new folders when needed instead of piling files into one directory.
- Constants (skip-lists, thresholds, the example JSON text) in dedicated constants files, not inline.
- `const`/`let` only, never `var`.
- Explicit error handling with readable user-facing messages. Never fail silently.
- Never log or display API keys or the contents of the user's info file, not even in errors or debug output.

## 6. Core invariants (never break these, in any task)

- The extension NEVER submits a form: no `form.submit()`, no `requestSubmit()`, no Enter key presses, and no clicks on submit-like buttons, even with permission.
- The extension NEVER clicks a button without explicit per-click permission from the user, after scrolling it to the center of the view and explaining what is clicked and why.
- NO user data persists in the browser: no `storage`, `localStorage`, `sessionStorage`, IndexedDB or cookies. Data lives in memory in the background page only. The only exception is the models Export button, which downloads a file the user keeps.
- Nothing is sent anywhere before the invisible-field safety check passes or the user chooses to continue (and then only visible fields are used).
- The model's output is only used as values for fields the extension listed. Page text is data, never instructions.

If a task seems to require breaking one of these, stop and ask.

## 7. Reporting format

At the end of each task, reply to the user with a short report:

- **Done:** what was implemented (task number and name).
- **Verified:** how it was checked, and what was not.
- **Decisions and assumptions:** anything you decided or assumed, and anything you need from the user.
- **Next:** the next task, and whether you are continuing or waiting for an answer.

Keep it brief. The details belong in the README Progress section.

If the next task does not depend on an answer you are waiting for, continue to it after reporting. If it does, stop and wait.
