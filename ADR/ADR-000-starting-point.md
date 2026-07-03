# ADR-000 — Starting point: scaffold from Vercel Commerce, provider intact

- **Status:** Accepted
- **Date:** 2026-07-03
- **Context unit:** STOREFRONT-PHASE §4.1 (`storefront-bootstrap`)
- **Decision drivers:** D1 (new sibling repo), the "keep the starter's provider abstraction
  intact" instruction, and the print-don't-run publishing rule.

## Context

The Truvio Commerce demo ecosystem needs a **headless frontend** layer (a full Next.js
storefront) driven by a DynamicWeb 10 backend, reaching parity with the Swift Razor
storefront. Rather than build a storefront from scratch, we adopt a mature headless
starter whose provider abstraction gives us a clean seam to plug DynamicWeb into.

## Decision

1. **Scaffold from [`vercel/commerce`](https://github.com/vercel/commerce)** — the Next.js
   App Router headless starter (React Server Components + Server Actions + a swappable
   provider). Pulled with `pnpm dlx degit vercel/commerce` (HEAD; `.git` stripped).
2. **Keep the starter's structure and provider abstraction intact.** The default Shopify
   provider under `lib/shopify/` remains in place as a placeholder. Replacing it with a
   DynamicWeb provider is deferred to `ADR-001` (the D2 open design fork).
3. **New sibling repo** `Truvio.Commerce.Storefront` (D1), local `git init` only. The
   GitHub repo is **not** created here — see §6 (print-don't-run).
4. **Ecosystem scaffolding** added alongside the starter: `README.md`, `CONTRIBUTING.md`
   (merge gate mirroring Baselines/DemoThemes), `docs/`, `ADR/`, and the `swift/2.3`
   version stamp.

## Starting-point facts (as scaffolded)

| Fact | Value |
|---|---|
| Source | `vercel/commerce` @ HEAD (via `degit`), `.git` stripped |
| Framework | Next.js `15.6.0-canary.60` (App Router, RSC, PPR) |
| React | `19.0.0` |
| Styling | Tailwind CSS v4 (`@tailwindcss/postcss`) |
| Default provider | Shopify Storefront GraphQL (`lib/shopify/`) |
| Toolchain | Node `v22.19.0`, pnpm `11.9.0` |
| Provider domain types | `Product`, `Collection`, `Cart`, `Menu`, `Page` (see `docs/architecture.md`) |

## Build verification

### `pnpm install` — PASS (exit 0)

One adjustment was required for pnpm 11.9: the starter shipped a placeholder
`pnpm-workspace.yaml` (`allowBuilds: sharp: set this to true or false`). Replaced with a
valid allowlist so the `sharp` native install script runs and install exits 0:

```yaml
allowBuilds:
  sharp: true
```

Without it, `pnpm install` trips `ERR_PNPM_IGNORED_BUILDS` and returns exit 1 even though
all packages resolve. (Note: pnpm 11.9 no longer reads the `pnpm.onlyBuiltDependencies`
field from `package.json`; the setting lives in `pnpm-workspace.yaml`.)

### `pnpm build` — PASS (exit 0) against a provider, FAILS offline with no provider

The starter's `next build` **statically prerenders** pages that fetch from the provider at
build time (homepage collections, footer `getMenu`, `/_not-found`). There is **no**
`generateStaticParams` in the app, so PDP/PLP dynamic routes are not prerendered — only the
static pages fetch. Two verified outcomes:

1. **Unreachable placeholder domain** (`.env` with `SHOPIFY_STORE_DOMAIN=mock-provider.invalid`):
   - Compile phase succeeds: `✓ Compiled successfully in 3.2s` (TypeScript + lint + bundling clean).
   - Export phase fails: 4× `ConnectTimeoutError` fetching the provider; `Error occurred
     prerendering page "/_not-found"`; build exits 1. **Expected** for the stock starter offline.

2. **Provider returning HTTP 200 empty-but-valid GraphQL** — `pnpm build` exits **0**:
   ```
   ✓ Compiled successfully
   ✓ Generating static pages (11/11)
   BUILD_EXIT=0
   ```
   Empty data renders gracefully (e.g. `ThreeItemGrid` returns `null` below 3 products;
   `getMenu` returns `[]`). The crash in case (1) is the fetch **throwing**, not empty data.

**Offline-build reproduction (no live backend, no invented real endpoint).** A throwaway
local TLS stub answering every POST with empty shapes is sufficient. Not committed (lives in
the harness scratchpad); reproduce with:

```js
// server.mjs — self-signed TLS; returns 200 for every POST
import https from 'node:https'; import { readFileSync } from 'node:fs';
const opts = { key: readFileSync('key.pem'), cert: readFileSync('cert.pem') };
const EMPTY = { data: { menu:{items:[]}, collection:null, collections:{edges:[]},
  products:{edges:[]}, product:null, productRecommendations:[], pages:{edges:[]},
  pageByHandle:null, cart:null } };
https.createServer(opts, (req,res)=>{ let b=''; req.on('data',c=>b+=c);
  req.on('end',()=>{ res.writeHead(200,{'Content-Type':'application/json'});
  res.end(JSON.stringify(EMPTY)); }); }).listen(8443,'127.0.0.1');
```
```bash
openssl req -x509 -newkey rsa:2048 -nodes -keyout key.pem -out cert.pem -days 2 -subj "/CN=localhost"
node server.mjs &
NODE_TLS_REJECT_UNAUTHORIZED=0 SHOPIFY_STORE_DOMAIN="localhost:8443" \
  SHOPIFY_STOREFRONT_ACCESS_TOKEN="x" SHOPIFY_REVALIDATION_SECRET="x" \
  COMPANY_NAME="Truvio Commerce" SITE_NAME="Truvio Commerce Storefront" \
  pnpm build   # -> exit 0, 11/11 static pages
```

### Minimal `.env` (gitignored; placeholders only)

```
COMPANY_NAME="Truvio Commerce"
SITE_NAME="Truvio Commerce Storefront"
SHOPIFY_REVALIDATION_SECRET="local-build-placeholder"
SHOPIFY_STOREFRONT_ACCESS_TOKEN="local-build-placeholder"
SHOPIFY_STORE_DOMAIN="mock-provider.invalid"   # .invalid = never resolves (RFC 2606)
```

`ADR-001` will replace `SHOPIFY_*` with the DynamicWeb provider's variables.

## §5 — Vercel / provider coupling inventory (input for the D2 backend agent)

Enumerated so the backend/self-hosting agent can note and, where practical, remove them.
**Finding: this starter version pulls NO `@vercel/*` npm packages** — `package.json` has no
`@vercel/analytics`, `@vercel/speed-insights`, or Vercel Toolbar. All couplings below are
either Next.js features or cosmetic links; none require a Vercel account.

| # | Coupling | Location | Notes / action for D2 |
|---|---|---|---|
| 1 | On-demand ISR via `revalidateTag` | `lib/shopify/index.ts:11,535,539` (`revalidateTag(TAGS.collections\|products, "seconds")` in the `/api/revalidate` webhook) | Works under `next start` on any Node host. The DW provider must expose an equivalent revalidation webhook (DW content-change → tag revalidation). |
| 2 | Cache-tag primitives | `lib/shopify/index.ts:9-10` (`unstable_cacheLife`, `unstable_cacheTag`) + `"use cache"` in provider fns | Next canary caching. Portable; keep the tag taxonomy when porting the provider. |
| 3 | `updateTag` import | `components/cart/actions.ts:11` (from `next/cache`) | Cart mutation cache invalidation. Portable; re-point to DW cart tags. |
| 4 | `VERCEL_PROJECT_PRODUCTION_URL` | `lib/utils.ts:3-5` (`baseUrl`) | Only Vercel sets this; falls back to `http://localhost:3000`. For self-host, drive `baseUrl` from an explicit env var (e.g. `SITE_URL`). Feeds sitemap/robots/OG absolute URLs. |
| 5 | Next canary experimental flags | `next.config.ts` (`ppr:true`, `inlineCss:true`, `useCache:true`) | Require the pinned `next@15.6.0-canary.60`. Not account-bound, but pin-sensitive; decide whether to keep PPR when wiring DW. |
| 6 | Image host allowlist | `next.config.ts` `images.remotePatterns` → `cdn.shopify.com` | Provider-specific. Replace with the DW media/CDN host(s). |
| 7 | Cosmetic Vercel/Shopify links | `README.md` (upstream, preserved in `docs/upstream/`), `components/layout/footer.tsx:47-71`, `components/welcome-toast.tsx`, `app/page.tsx:7`, `lib/utils.ts:37` | "Deploy on Vercel" button, "Created by ▲ Vercel", Shopify docs link. Rebrand/remove during parity work; no functional impact. |

## §6 — Publishing (print-don't-run)

The GitHub repo is **not** created and nothing is pushed by this unit. When the operator
approves, run (GitHub owner `justdynamics`, matching the sibling repos):

```bash
# from C:/VibeCode/Truvio.Commerce.Storefront (already git-init'd, commits present)
gh repo create justdynamics/Truvio.Commerce.Storefront \
  --private \
  --source . \
  --remote origin \
  --description "Headless commerce storefront (Next.js App Router) driven by DynamicWeb 10 — Truvio Commerce demo ecosystem, swift/2.3." \
  --disable-wiki

git branch -M main
git push -u origin main
```

To make it public instead, replace `--private` with `--public`. Do **not** push `.env`
(gitignored) or any live endpoint/secret.

## Consequences

- The provider seam is preserved, so `ADR-001` can swap in DynamicWeb with minimal churn to
  UI/routes.
- Offline CI can build green using a provider stub; the real gate builds against the DW10
  backend.
- The Vercel couplings are catalogued and mostly cosmetic; self-hosting is unobstructed.
