# Verity

A newspaper-style web app that synthesizes news from a curated whitelist of
trusted outlets.

This repo contains:

- **Phase 1** — Next.js front-end shell with the broadsheet design system,
  fixture front page, and a fully-rendered compiled story page (live).
- **Phase 2** — ingestion pipeline scaffolding (RSS pull, Readability
  extraction, embeddings, clustering) ready to deploy as a Supabase Edge
  Function. Real polling starts when the project is linked to Supabase.
- **Phase 3** — synthesis pipeline scaffolding (LLM provider abstraction,
  synthesis prompt, post-validation, four-mode cluster assembly) ready to
  deploy. Real syntheses start when API keys land in Supabase function secrets.
- **Phase 4** — Stripe webhook + Supabase auth/usage hooks (stubs).

Design and architecture docs live in the design-doc repo (OVERVIEW.md,
ARCHITECTURE.md, IMPLEMENTATION_PLAN.md, PROJECT_STRUCTURE.md, TECH_STACK.md,
PROMPT_DESIGN.md, SOURCE_WHITELIST.md, mockup.html). **Treat the docs as the
source of truth.**

## Stack

- Next.js 15 App Router + React 19 + TypeScript 5.7
- Tailwind CSS 3.4 with the newspaper theme tokens in `tailwind.config.ts`
- Supabase (Auth, Postgres, Edge Functions, pgvector)
- Anthropic Claude (primary) + OpenAI (fallback + embeddings)
- Stripe for premium subscriptions
- Vitest for unit/integration tests, Playwright for e2e

## Prerequisites

- **Node 20+** and **pnpm 9+**
- **Supabase CLI** for the local Postgres + edge functions stack (`brew install supabase/tap/supabase` on macOS, or see [supabase.com/docs/guides/cli](https://supabase.com/docs/guides/cli))
- **An Ollama-capable host (or vLLM server) reachable from the Supabase Edge Functions environment.** For local dev, install [Ollama](https://ollama.com/) and pull the four pinned models with `ollama pull <model>`:
  ```bash
  ollama pull deepseek-r1-distill-qwen-32b   # primary synthesis
  ollama pull gemma3:27b                     # fallback synthesis
  ollama pull gemma3:4b                      # per-article analysis
  ollama pull nomic-embed-text               # 768-dim embeddings
  ```
  Production points `LLM_BASE_URL` at a vLLM instance on a rented A100/H100 — see `TECH_STACK.md` → GPU Hosting.
- **Vendor LLM keys are NOT required by default.** Anthropic and OpenAI are optional fallbacks loaded only when `LLM_FALLBACK_ENABLED=true`.

## Run it

```bash
pnpm install
pnpm dev
# open http://localhost:3000
```

To run the full local stack (Postgres + Edge Functions):

```bash
supabase start
supabase db reset            # rebuild from migrations + seed
supabase functions serve     # serve edge functions locally
```

Other scripts:

```bash
pnpm build       # production build
pnpm lint        # next lint
pnpm typecheck   # tsc --noEmit
pnpm format      # prettier --write
pnpm test        # vitest run (unit + integration)
pnpm test:e2e    # playwright test
```

## Routes

| Route | What it shows |
|-------|---------------|
| `/` | Front page — lead `StoryView` + side-rail `StoryCard`s (fixtures until Phase 3 lands real data) |
| `/topic/[slug]` | Compiled story view |
| `/topic/new` | Compile-mode landing (placeholder) |
| `/section/[name]` | Section landings: world / us / business / markets / tech / culture |
| `/source/[domain]` | Per-outlet profile from the whitelist |
| `/how-it-works` | Methodology + whitelist explainer |
| `/login` `/account` | Auth + account (Phase 4) |
| `/api/synthesize` | POST proxy to the `/synthesize` edge function |
| `/api/webhooks/stripe` | Stripe subscription webhook handler |

## Module layout

Mirrors `PROJECT_STRUCTURE.md`:

- `src/components/newspaper/` — Masthead, Dateline, SectionRule, MultiColumn,
  DropCap, PullQuote, DisagreementCallout
- `src/components/stories/` — StoryView, StoryCard, SourceStrip, SourceChip,
  ClaimAttribution
- `src/components/search/` — TopicSearchBar (the four-mode Compile bar)
- `src/lib/source-whitelist.ts` — canonical TS mirror of the `sources` table
- `src/lib/supabase/{client,server,admin}.ts` — three flavors of Supabase client
- `src/lib/types/` — story / source / article types
- `src/lib/fixtures/stories.ts` — Phase-1 fixtures used by the front page
- `src/hooks/` — useAuth, useUsage, useSynthesis (Phase 4 client hooks)
- `supabase/migrations/` — schema migrations (mirror the design-doc repo)
- `supabase/seed.sql` — seeds the `sources` whitelist
- `supabase/functions/_shared/` — Deno-side modules: cors, auth, supabase,
  whitelist (DB-backed), rss, readability, embed, cluster, postprocess,
  llm/{provider,anthropic,openai,prompts}, slug
- `supabase/functions/{ingest-feeds,synthesize,front-page,check-source,user-usage}/`
  — five edge functions
- `tests/unit/` — vitest tests for whitelist, postprocess, prompts, utils
- `tests/e2e/` — playwright smoke tests for front page + story page

## Conventions

- Path aliases (`@/lib/*`, `@/components/*`, …) wired in `tsconfig.json`
- Default to server components; only `TopicSearchBar` and the hooks are `"use client"`
- `revalidate` matches the cache TTLs from ARCHITECTURE.md (front page 5 min,
  story 30 min)
- Whitelist is dual-source by design: `src/lib/source-whitelist.ts` for
  build-time UI, `sources` table for runtime ingestion. Both must change
  together.
- All LLM calls go through `LLMProvider` in `supabase/functions/_shared/llm/`
- After every `/synthesize` call, `validateSynthesis` enforces: every paragraph
  has a citation, every claim fuzzy-matches a source article, every cited
  domain is whitelisted. Failures regenerate once, then fail.
- Secrets: never put LLM/Stripe/service-role keys on Vercel. Prefer Supabase
  function secrets. Anything that must live on Vercel is marked **Sensitive**.

## Deployment notes

- Set Supabase function secrets (`supabase secrets set ...`):
  - `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`
  - `VERITY_SITE_URL` (for CORS)
- Cron schedules (configure in Supabase dashboard):
  - `ingest-feeds`: every 15 minutes
  - `front-page`: every 60 minutes
- Vercel env vars (mark as **Sensitive**):
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (or move to Supabase)
- Run `supabase db push` to apply migrations to the linked project.
- After the project is linked, run `supabase gen types typescript --linked >
  src/lib/supabase/types.ts` to replace the hand-maintained types module.

## What's still mocked

- The front page renders fixtures from `src/lib/fixtures/stories.ts` until
  the `/front-page` cron has produced enough real compiled stories.
- `/topic/new` echoes the submitted Compile-mode payload but does not call the
  synthesis route. Wire it up by changing the form action to POST `/api/synthesize`
  and redirecting to `/topic/[returned-slug]`.
- The Phase-3 `assembleFromQuery` in the synthesize edge function uses simple
  ILIKE matching. The pgvector cosine search hooks are in place
  (007_enable_pgvector.sql + `embed.ts`); swap the matcher when tuning.
