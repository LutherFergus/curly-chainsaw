# Agent instructions

## Pull requests

When a task’s code changes are complete (implemented, lint/build clean, PR opened or updated):

1. Mark the PR ready for review (not draft).
2. **Merge it into `main` immediately** with a merge commit (`gh pr merge <n> --merge --delete-branch`).
3. Do not wait for the user to ask “merge” or “merged?”.

Only leave a PR unmerged if it is blocked (conflicts, failing required checks you cannot fix, or the user explicitly said not to merge).
