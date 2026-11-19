# InSight repository instructions

- The application uses strict TypeScript, Next.js App Router, and pnpm.
- Pure scoring and matching functions belong in `src/lib/engine/`; do not put I/O in the engine.
- Never invent assessment items, O*NET occupation data, norms, or statistics. Identify fixtures and their provenance.
- InSight is for personal career exploration, not hiring or employment decisions.
- Every sentence in a results report must trace to computed scores.
- Keep personal data access scoped to the authenticated user. Never commit secrets or user-supplied data files.
- Use `pnpm lint`, `pnpm typecheck`, and `pnpm test` for checks; use `pnpm test:e2e` for the browser test.
- See the README for setup, imports, and data licensing.
