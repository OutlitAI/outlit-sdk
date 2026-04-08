# Skill: outlit-pr-coderabbit-followthrough

# Outlit PR CodeRabbit Followthrough

Use this when the job is not just "open a PR", but to carry it through the first CodeRabbit review cycle in an Outlit repo.

## Scope

- Applies to Outlit GitHub repos that use `gh`, PRs to `staging`, and CodeRabbit review threads.
- Treat PR creation, CI watching, CodeRabbit polling, follow-up fixes, and thread resolution as one workflow.
- Do not commit unrelated local artifacts such as screenshots, scratch docs, or temporary notes unless the user explicitly asks.
- Resolve only threads you actually addressed.

## Workflow

1. Prepare the branch before creating the PR.
- Inspect the worktree with `git status --short --untracked-files=all`.
- Stage intended files explicitly. Do not use `git add .` when there are unrelated artifacts.
- Verify the branch content with `git diff --stat`, `git diff`, and `git diff staging...HEAD` as needed.
- Rebase onto `origin/staging` before opening the PR:
  - `git fetch origin staging`
  - `git rebase origin/staging`

2. Run fresh local verification before pushing.
- Use the narrowest meaningful test command plus required repo verification such as `bun run typecheck`.
- Do not create or update the PR while local verification is stale.

3. Push and create the PR against `staging`.
- `git push -u origin <branch>` if the branch has no upstream.
- Create the PR with `gh pr create --base staging ...`.
- Capture the PR number and URL immediately.

4. Watch CI on the new PR.
- Run `gh pr checks <pr-number> --watch`.
- If checks fail, fix CI first, re-verify locally, push, and re-watch checks.

5. Poll CodeRabbit for up to 20 minutes.
- Start the timer when the PR is created or when the user explicitly asks you to begin monitoring.
- Use a fixed cadence unless the user says otherwise: minute 0, 3, 6, 9, 12, 15, 18, and one final check near minute 20.
- Treat the 20-minute window as the primary monitoring window for the current PR head.
- Use PR review threads, not only top-level comments.
- A good GraphQL query is:
```sh
gh api graphql -f query='query($owner:String!,$repo:String!,$number:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$number){reviewThreads(first:100){nodes{id isResolved comments(first:20){nodes{id author{login} body url createdAt path line}}}}}}}' \
  -F owner=<owner> -F repo=<repo> -F number=<pr-number>
```
- Filter for CodeRabbit authors and unresolved threads.

6. Triage review comments technically.
- Check each CodeRabbit suggestion against the actual code and repo conventions.
- Fix the valid ones.
- Push back in-thread on invalid ones with technical reasoning instead of silently resolving them.

7. After each valid fix batch, repeat the verification loop.
- Batch related valid comments into one follow-up change when practical.
- Do not push once per thread unless the comments are independent and tiny.
- Run the relevant local tests and `bun run typecheck` if the change can affect types.
- Push the follow-up commit.
- Run `gh pr checks <pr-number> --watch` again.
- Poll CodeRabbit again after the new push because a follow-up review can appear.
- Do not restart a full 20-minute window after every push unless the user explicitly asks.
- After a follow-up push, do one additional short watch cycle even if the original 20-minute window has expired:
  - poll immediately after push
  - poll again about 3 to 5 minutes later
  - if CodeRabbit is still `pending`, keep polling up to about 10 to 12 minutes after that push

8. Resolve only addressed threads.
- Use GitHub GraphQL thread resolution, not a top-level PR comment.
- Resolve a thread only after the fix is pushed.
- Leave a thread open if the fix is partial, if you disagreed with the comment, or if the thread has multiple comments and not all actionable items were addressed.
- If a thread mixes valid and invalid sub-comments, reply in-thread and leave it open unless every actionable issue in that thread is addressed.
- Example:
```sh
gh api graphql -f query='mutation($threadId:ID!){resolveReviewThread(input:{threadId:$threadId}){thread{id isResolved}}}' \
  -F threadId=<thread-id>
```

9. Reply in-thread on invalid comments.
- Do not post a top-level PR comment for a line-level disagreement.
- Use the review-comment reply endpoint:
```sh
gh api repos/<owner>/<repo>/pulls/comments/<comment-id>/replies -f body='Not applying this because <technical reason>'
```

## Heuristics

- In Outlit repos, assume the PR base is `staging`, not `main`, unless the user says otherwise.
- After any follow-up push, previous green CI is no longer sufficient. Re-watch the updated checks.
- CodeRabbit can finish late. Do not stop after the first quiet poll.
- If CodeRabbit comments arrive near the end of the 20-minute window, finish that fix cycle completely instead of stopping at the timer boundary.
- If the monitoring window expires with no new threads, say that explicitly instead of implying permanent silence.
- Reply in-thread on invalid or non-actionable comments so unresolved threads show that they were reviewed intentionally.
- A single green CI run is only valid for the current PR head. Any push resets the watch loop.
- If local artifacts remain intentionally uncommitted, call that out in the final status.

## Common Mistakes

- Opening the PR against the wrong base branch.
- Including screenshots, temp docs, or scratch files in the PR.
- Watching CI only once and forgetting to re-watch after a follow-up push.
- Checking `gh pr view --comments` but not unresolved review threads.
- Resolving every bot thread after a push instead of only the ones actually addressed.
- Treating a small CodeRabbit fix as too minor for fresh verification.

## Deliverable

Report back with:

- PR URL
- whether CI is green on the latest push
- whether CodeRabbit posted comments during the monitoring window
- what valid comments were fixed
- which threads were resolved
- whether any local artifacts were intentionally left out of the PR
