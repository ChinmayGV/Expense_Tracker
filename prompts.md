# Prompt Library

Replace bracketed placeholders with details from the task before using a template.
Include relevant files, commands, and existing conventions when available.

## New feature

```text
Context:
[Describe the application, relevant files, existing behavior, and conventions.]

Goal:
Implement [feature] for [users or use case].

Constraints:
- Preserve existing behavior outside this feature.
- Follow the project's existing patterns and dependencies.
- Handle invalid and boundary inputs explicitly.
- Do not add dependencies unless necessary.

Acceptance criteria:
- [Observable behavior that can be verified by a test.]
- [Error or boundary behavior that can be verified by a test.]
- Relevant tests pass, and the production build succeeds.

Examples:
- Given [starting state], when [action], then [expected result].
```

## Bug fix

```text
Context:
[Describe the application, relevant files, and how the behavior currently works.]

Bug:
[Describe the incorrect behavior and its impact.]

Reproduction:
1. [Starting state]
2. [Actions or input]
3. [Observed result]

Expected behavior:
[Describe the correct result.]

Constraints:
- Fix the root cause with a focused change.
- Preserve unrelated behavior and existing public interfaces.
- Add a regression test that fails before the fix and passes after it.

Acceptance criteria:
- A regression test reproduces the reported case and passes with the fix.
- [Relevant boundary case] is covered by a test.
- Relevant tests pass, and the production build succeeds.
```

## Refactor

```text
Context:
[Describe the area to refactor, its callers, and existing conventions.]

Goal:
Refactor [code or module] to [measurable maintainability or structure goal].

Constraints:
- Keep externally observable behavior and public interfaces unchanged.
- Avoid unrelated cleanup and new dependencies.
- Preserve error handling and accessibility behavior.

Acceptance criteria:
- Existing tests for [area] pass unchanged.
- [Specific invariant] is verified by a test.
- Relevant tests pass, and the production build succeeds.

Examples:
- Before: [current structure or behavior]
- After: [desired structure with unchanged behavior]
```

## Generate tests

```text
Context:
[Describe the code under test, its public behavior, and test framework.]

Goal:
Add tests for [function, component, or feature] that verify behavior, not implementation details.

Constraints:
- Follow the existing test framework and conventions.
- Keep tests deterministic; do not rely on real network calls, timers, or external state.
- Do not change production code unless a testability issue prevents meaningful coverage.

Acceptance criteria:
- Tests cover the main success path.
- Tests cover invalid input, errors, and relevant boundary cases.
- Tests assert observable outputs or user-visible behavior.
- The new tests pass with the project's test command.

Examples:
- Given [input or state], when [operation], then [expected assertion].
```

## Review diff

```text
Context:
[Describe the intended change and any relevant requirements.]

Goal:
Review the diff for concrete defects, regressions, and missing tests.

Constraints:
- Review only the supplied diff and directly relevant context.
- Prioritize findings by severity and include file and line references.
- Report actionable issues, not style preferences.
- If no issues are found, say so and note any validation limits.

Acceptance criteria:
- Each finding explains the triggering condition and impact.
- Findings include a severity and precise location.
- No speculative or duplicate findings are included.

Diff:
[Paste the diff or provide its location.]
```

## Commit message

```text
Context:
[Describe the change and its motivation.]

Goal:
Write one concise commit message for the supplied diff.

Constraints:
- Use imperative mood in the subject.
- Keep the subject at or below 72 characters.
- Do not claim changes that are not present in the diff.
- Add a short body only when it clarifies why the change was needed.

Acceptance criteria:
- The subject accurately summarizes the change.
- The subject is imperative and no longer than 72 characters.
- The message contains no unsupported claims.

Diff or change summary:
[Paste the diff or describe the changes.]
```

## Add expense feature

### Context

This project is an expense-tracking application built with React and Vite. The
React app is mounted from `src/main.jsx`, and the current application component
is `src/App.jsx`. Follow the existing project structure and styling conventions.
Do not assume a backend or persistence layer exists; keep the feature in the
client unless the project has since added an established data layer.

### Goal

Implement an “Add expense” form that lets a user enter an expense description,
amount, date, and category, submit it, and see the new expense in the application.
Use a clear, accessible form and provide immediate validation feedback.

### Constraints

- Use the existing React and Vite setup; do not add dependencies.
- Keep form and expense state in React, not direct DOM mutations.
- Store amount as a positive finite number and display it consistently as a
  currency amount.
- Use semantic labels and native form controls; associate validation feedback
  with the relevant inputs.
- Do not add persistence, editing, deletion, or unrelated dashboard features.
- Add or update tests using the test framework already present. If there is no
  test framework, add the smallest suitable one only if needed to verify the
  acceptance criteria.

### Acceptance criteria

- A test renders the form and finds labeled description, amount, date, and
  category controls, plus a submit button.
- A test submits valid values and verifies that the new expense appears with the
  entered description, formatted amount, date, and selected category.
- A test submits an empty description and verifies that an accessible
  description validation message appears and no expense is added.
- A test submits a zero or negative amount and verifies that an accessible
  amount validation message appears and no expense is added.
- A test submits a non-numeric amount and verifies that it is rejected and no
  expense is added.
- A test submits a valid expense and verifies that the form is reset after
  submission.
- The production build completes successfully.

### Examples

- Given a description of `Groceries`, amount `42.50`, date `2026-10-28`, and
  category `Food`, when the user submits the form, then an expense showing
  `Groceries`, `$42.50`, the selected date, and `Food` appears.
- Given an amount of `0`, when the user submits the form, then an amount error
  appears and the expense list remains unchanged.
