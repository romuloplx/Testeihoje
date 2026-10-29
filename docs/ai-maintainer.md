# AI project maintainer

This repository includes a deliberately bounded GitHub Actions maintainer. It asks Cohere Command-A through Unorouter for **one** small code improvement, applies only a unified diff to tracked source files under `public/`, `vercel/api/`, or `tests/`, rejects configuration/secret/workflow/dependency edits, runs `git diff --check` and the full `npm test` suite, then pushes passing changes only to `arena/2cf1868f-testeihoje`. Vercel can build that branch as a preview; this workflow never pushes to `main` or promotes production.

## Required GitHub setup

- If a repository Actions secret named `UNOROUTER_API_KEY` is available, the maintainer prefers Cohere Command-A via Unorouter. The key stored only in Vercel is not automatically available to GitHub-hosted runners. Without that Actions secret, it uses the unauthenticated HackClub text endpoint already used by this application; that public fallback can be unavailable or rate-limited.
- The workflow needs Actions write permission for repository contents so it can push validated commits to the preview branch.
- A human push to `arena/2cf1868f-testeihoje` starts one maintenance run automatically. Run it with **Actions → AI project maintainer → Run workflow** to test again. Scheduled runs are weekly on Monday at 12:30 UTC, but GitHub only runs scheduled workflows defined on the repository's default branch. Until this workflow is merged into the default branch, push-triggered/manual runs work, but the weekly schedule does not.

If the API call, patch validation, or tests fail, the workflow stops without publishing the proposed change. A passing test suite is a gate, not a guarantee; inspect the resulting Vercel preview before promoting anything to production.
