# Truvio.Commerce.Storefront

A **headless commerce storefront** — a Next.js (App Router) application that renders
a full storefront (catalog, cart/checkout, customer center / B2B) against a
**DynamicWeb 10 (DW10)** backend. It is the fifth consumer in the Truvio Commerce
demo ecosystem and the frontend counterpart to the Swift Razor storefront.

Scaffolded from the [`vercel/commerce`](https://github.com/vercel/commerce) headless
starter (Next.js RSC + Server Actions + a swappable provider abstraction). The
starter's structure and its provider seam are kept **intact** — the default Shopify
provider under `lib/shopify` is a placeholder that a DynamicWeb provider replaces.
See `ADR/ADR-000-starting-point.md`.

## Where this sits in the ecosystem

The harness (`Truvio.Commerce.Serializer.BaselineUpdater`) builds and validates demos
across layers. This repo adds the **headless frontend** layer:

```
Serializer engine → Serialized baselines → DemoThemes → Feature packs → Headless Storefront (this repo)
   (external)         swift/2.4            (disk overlay)  (custom-code)   (Next.js, DW10-driven)
```

- **Backend:** DynamicWeb 10 + SQL Server, exposing content/commerce through its
  headless surface (Delivery API and/or GraphQL/OData — the integration approach is an
  open design fork resolved by `ADR/ADR-001-backend-integration.md`, authored next).
- **Content:** supplied by a dedicated serialized baseline `baseline/headless/2.4`
  (zero-custom-code YAML, a distinct product line from `swift/2.4`), authored in the
  harness and gate-validated there.
- **Swift version target:** rolling latest-only. Currently **Swift 2.4** — see the
  `swift/2.4` stamp at the repo root. Rolls forward when the next release ships; the prior is dropped.
- **Compatibility statement:** `compat` in `package.json` — the same shape the
  Distribution's base contract carries (`layers/base/base.contract.json`), scoped to what a
  headless consumer actually needs: the DW platform floor (`dw.min`) and the Delivery API it
  drives (`deliveryApi.base`, `deliveryApi.openapi`). It is a **floor**, not a support matrix.
  No serializer entry: this repo never deserializes a layer — it reads `/dwapi` over HTTP. No
  Swift entry either: the Delivery API is design-package-independent (the `headless-demo`
  edition is gate-proven with zero Swift dependency), so the Swift target stays the `swift/2.3`
  stamp above and nothing restates it.

## Status

Bootstrap (Stage 1, unit `storefront-bootstrap`). The stock starter is scaffolded and
**builds green offline** (see below). The DynamicWeb data layer, the headless baseline,
and feature parity are follow-on units — tracked in `docs/parity-matrix.md` once the
backend integration lands.

## Running locally

Node 22 + pnpm are required. No Vercel account is required to build or run
(the starter is a plain Next.js app; "Vercel" is one hosting option among many).

```bash
pnpm install
pnpm dev      # http://localhost:3000
```

### Environment

Copy `.env.example` to `.env` and fill it. `.env*` is gitignored — never commit
secrets, never commit live endpoints. The current placeholder set targets the default
Shopify provider seam; the DynamicWeb provider will introduce its own variables in
`ADR-001`.

### Building offline (no live backend)

`next build` statically prerenders pages that fetch from the provider at build time
(footer menu, homepage collections, the not-found page). The stock starter therefore
needs a provider endpoint that returns HTTP 200 to build. Two facts, both verified:

- With an **unreachable** placeholder domain, `pnpm build` fails in the *export* phase
  (compile succeeds; static prerender cannot fetch). This is expected for the stock
  starter offline.
- With **any** provider endpoint returning HTTP 200 with empty-but-valid GraphQL
  shapes, `pnpm build` succeeds (exit 0, all pages generated). A throwaway local TLS
  stub is sufficient — see `ADR/ADR-000-starting-point.md` for the exact reproduction.

## Publishing

This repository is **not** created or pushed automatically. Publishing is
**print-don't-run** and human-gated — the operator commands to create the GitHub repo
and push are printed in `ADR/ADR-000-starting-point.md`. See `CONTRIBUTING.md` for the
merge gate.

## Layout

- `app/`, `components/`, `lib/`, `fonts/` — the Next.js starter (structure intact).
- `lib/shopify/` — the default provider (placeholder; replaced by the DW provider).
- `swift/2.4` — Swift-version stamp for the rolling latest-only target.
- `package.json` `compat` — the DW platform floor + the Delivery API this storefront drives.
- `docs/` — architecture, parity matrix (later), upstream reference.
- `ADR/` — architecture decision records.
- `CONTRIBUTING.md` — the merge gate.
