This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Testing

### Unit and integration (Vitest)

[Vitest](https://vitest.dev/) + [React Testing Library](https://testing-library.com/react) (happy-dom). Server-style tests mock Supabase — **no** real `NEXT_PUBLIC_SUPABASE_*` values are required for `npm run test`.

```bash
npm run test        # CI-style single run
npm run test:watch  # watch mode while developing
```

Tests live under `src/**/*.test.{ts,tsx}`: utils (`recurring-dates`, `recurring-upcoming`, `budget-health` + `computeBudgetAlertRows`, `dashboard-onboarding`, `transaction-add-query`, dates, CSV, currency, `cn`), **command palette** and **privacy mode** (RTL), `PageHeader`, `useCurrency`, `auth/callback`, `updateSession` (including `/transactions?add=1` redirect).

### E2E smoke (Playwright)

[Playwright](https://playwright.dev/) drives a real browser against a production build. By default the test runner starts `npm run build && npm run start` on **port 3001** so it does not collide with `next dev` on 3000.

```bash
npx playwright install chromium   # once per machine (CI installs in workflow)
npm run test:e2e                  # build + serve + run `e2e/*.spec.ts`
npm run test:e2e:ui               # interactive UI mode
```

Optional env:

- `PLAYWRIGHT_BASE_URL` — e.g. `http://127.0.0.1:3000` to reuse an already-running dev server (skips spawning `webServer` when the URL responds).
- `PLAYWRIGHT_PORT` — port for the spawned server (default `3001`; ignored if `PLAYWRIGHT_BASE_URL` is set).

**Scope today:** unauthenticated smoke (`/login`, `/` → `/login`), plus **UX gate checks** in [`e2e/ux-features.spec.ts`](e2e/ux-features.spec.ts) (`/transactions?add=1` → login, no command palette on `/login` after Ctrl+K). Full magic-link login, authenticated palette/dashboard/privacy E2E, and Supabase RLS need a test inbox, auth **storageState**, or separate DB tests — see below.

### CI

[`.github/workflows/finance-ci.yml`](.github/workflows/finance-ci.yml) runs on every push and pull request. It calls [`.github/workflows/finance-ci-reusable.yml`](.github/workflows/finance-ci-reusable.yml) to run Vitest, install Playwright Chromium, and run `npm run test:e2e`.

On pushes to the **default branch** only, **Deploy (after tests)** runs after tests succeed. If tests fail, that job is skipped. Add real deploy steps there if you want Actions to publish, or use **GitHub rulesets / branch protection** and require status check **Finance CI / Unit, integration, and E2E**.

### Optional: database / RLS (Supabase + pgTAP)

Postgres behavior (RLS, triggers in `supabase/migrations/`) is best validated with **Supabase CLI** (`supabase db test`) and **pgTAP** SQL under something like `supabase/tests/`, using `supabase start` or a CI service container. That is separate from Vitest.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
