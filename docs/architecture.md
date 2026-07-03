# Architecture

## What this is

A Next.js (App Router) **headless storefront** that renders a full commerce experience
against a **DynamicWeb 10** backend. Scaffolded from `vercel/commerce`; the starter's
provider abstraction is the integration seam.

## The provider seam (the important part)

Vercel Commerce isolates all backend coupling behind a single provider module. The UI
and route handlers depend only on a small set of **domain types** and **data functions**,
never on the backend's wire format:

| Domain type | Consumed by | Provider function(s) |
|---|---|---|
| `Product` | PDP, PLP, grids, search, recommendations | `getProduct`, `getProducts`, `getProductRecommendations`, `getCollectionProducts` |
| `Collection` | PLP, search sidebar, nav | `getCollection`, `getCollections`, `getCollectionProducts` |
| `Cart` | cart, checkout, cart actions | `getCart`, `createCart`, `addToCart`, `updateCart`, `removeFromCart` |
| `Menu` | navbar, footer | `getMenu` |
| `Page` | content pages, `[page]` route | `getPage`, `getPages` |

In the stock starter these are implemented in `lib/shopify/index.ts` against Shopify's
Storefront GraphQL API. **Swapping the backend means replacing that module** (or adding a
sibling `lib/dynamicweb/`) so the same functions return the same domain types sourced from
DynamicWeb — the rest of the app is unchanged. This swap is the subject of
`ADR/ADR-001-backend-integration.md` (the D2 open design fork).

## Build-time data dependency

Several pages are server components that call provider functions during static
prerendering (homepage collections, footer `getMenu`, the not-found page). Consequences:

- A provider endpoint returning HTTP 200 is required for `next build` to complete.
- Provider fetch **throwing** (network failure) crashes prerender; provider returning
  **empty valid data** renders gracefully (e.g. `ThreeItemGrid` returns `null` when it
  has fewer than three products). See `ADR/ADR-000-starting-point.md` for the verified
  offline-build reproduction.

## Content vs. commerce data

Two distinct sources feed the storefront, matching the DynamicWeb model:

- **Content** (menus, content pages, semantic/editorial structures) → served from the
  headless serialized baseline `baseline/headless/2.3` via DW's content surface. Uses a
  new presentation-agnostic `Headless_*` item-type layer (STOREFRONT-PHASE D6), not
  Swift's presentation-coupled paragraph item types.
- **Commerce/PIM data** (products, variants, prices, orders, users, facets) → served from
  DW's product/order delivery endpoints, reusing the domain model and field conventions.

## Vercel couplings (for the backend agent)

The starter carries a few Vercel-flavored conveniences. None require a Vercel account,
but the self-hosting/DW-integration agent should note them — enumerated in
`ADR/ADR-000-starting-point.md` §5.
