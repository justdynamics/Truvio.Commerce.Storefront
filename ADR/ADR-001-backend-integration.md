# ADR-001: Backend Integration — DynamicWeb 10 Delivery API behind the Vercel Commerce provider contract

- Status: Accepted
- Date: 2026-07-03
- Deciders: storefront-backend-research (STOREFRONT-PHASE §4.2, open design fork D2)
- Context host: DW 10.26.9, Swift 2.3 baseline (`Harness-Swift-2.3`), https://localhost:57301

## Context

Stage 1 of the STOREFRONT-PHASE builds a Next.js storefront from the `vercel/commerce`
headless starter, driven by a DynamicWeb 10 backend, targeting parity with Swift 2.3.
D2 asks us to choose between:

- **(a)** a DynamicWeb data-layer that conforms to Vercel Commerce's provider contract
  (swap the default Shopify module for a DW module returning the same normalized domain
  types), or
- **(b)** a native DW rewrite — wire components directly to DW's headless surface and
  replace Vercel Commerce's domain types.

### What the live host actually exposes

DW 10 ships a single first-class headless surface: the **Delivery API** (`/dwapi/**`),
a REST/JSON API described by a live OpenAPI 3.0 document at
`https://<host>/dwapi/api.json` (Swagger UI at `/dwapi/docs/`). Probed on the running
host (v10.26.9, 93 operations). **There is no GraphQL and no OData surface** — `/graphql`,
`/odata`, `/api`, `/dwapi/content` (bare) all 404. The Delivery API is the only contract.

Relevant endpoints (all verified live):

| Concern | Method + path | Auth |
|---|---|---|
| Product detail | `GET /dwapi/ecommerce/products/{id}` (+ `/{id}/{variantId}`) | anonymous |
| Product list (index/facets) | `POST /dwapi/ecommerce/products` · `GET /dwapi/ecommerce/products/search` | anonymous |
| Product list (index-free) | `GET /dwapi/ecommerce/products/search?ProductIds=…` | anonymous |
| Variants | `GET /dwapi/ecommerce/variants/{productId}` | anonymous |
| Related / BOM | `GET /dwapi/ecommerce/products/{id}/related` · `/{id}/bom` | anonymous |
| Groups (collections) | `GET /dwapi/ecommerce/groups` · `/groups/{groupId}` | anonymous |
| Navigation / menu | `GET /dwapi/frontend/navigations/{areaId}` | anonymous |
| Content pages | `GET /dwapi/content/pages` · `/pages/{id}` · `/pages/url` | anonymous |
| Page rows / paragraphs | `GET /dwapi/content/rows/{pageId}/{device}` · `/content/paragraphs` | anonymous |
| Areas (site/domain map) | `GET /dwapi/content/areas` · `/areas/{id}` · `/areas/domain/{domain}` | anonymous |
| Cart | `POST /dwapi/ecommerce/carts/create` · `GET/PATCH/DELETE /carts/{secret}` · `/{secret}/items` · `/{secret}/createOrder` · `/{secret}/checkout` | cart secret (anon ok) |
| Countries/currencies | `GET /dwapi/ecommerce/International/countries` · `/currencies` | anonymous |
| Orders | `GET /dwapi/ecommerce/orders` · `/orders/{secret}` · `/orders/search` | **Bearer JWT** |
| Addresses / profile | `GET/PATCH /dwapi/users/addresses…` · `/users/info…` | **Bearer JWT** |
| Favorites (wishlist) | `GET/POST /dwapi/ecommerce/favorites/lists…` | Bearer JWT |
| Loyalty points | `GET /dwapi/ecommerce/loyaltyPoints/balance` · `/transactions` | Bearer JWT |
| **CSR impersonation (B2B)** | `GET /dwapi/users/impersonatees` · `/users/impersonate` | Bearer JWT |
| User auth | `POST /dwapi/users/token` · `POST/GET /dwapi/users/authenticate` · `/authenticate/refresh` | credentials → JWT |
| Password flows | `POST /dwapi/users/password/{change,reset,recover…}` | mixed |

### Auth model (confirmed on the host)

- **Catalog, groups, navigation, content, areas, cart = anonymous.** No token needed;
  the storefront reads the full catalog with no credential. Verified: product detail,
  groups, variants, areas, nav, pages all returned `200` unauthenticated.
- **User-scoped endpoints = Bearer JWT** in the `Authorization: Bearer <jwt>` header
  (OpenAPI `securitySchemes.Authorization`, http/bearer). The JWT is minted by
  `POST /dwapi/users/token` (or `/users/authenticate`) from frontend user credentials.
  This is a **different token** from the admin token minted at
  `/Admin/TokenAuthentication/authenticate` — the admin token authenticates admin/index
  APIs (`/admin/api/**`), not `/dwapi` user scope. Confirmed: passing the admin bearer to
  `/dwapi/ecommerce/products` produced `401`, while anonymous produced `200`.
- **Cart** uses an opaque per-cart `secret` (returned by `carts/create`); a cart can be
  anonymous and later bound to the authenticated user.
- **B2B price/permission gating** is server-side: user-scoped price/permission is applied
  when the JWT (or `PriceSettings.UserId`) is supplied; `impersonatees`/`impersonate`
  drive CSR impersonation.

### Vercel Commerce's "provider interface" in practice

The current `vercel/commerce` starter has no formal plugin SDK — its data layer is a single
module (`lib/shopify/`) exporting async functions (`getProduct`, `getProducts`,
`getCollection`, `getCollectionProducts`, `getCart`, `createCart`, `addToCart`,
`updateCart`, `removeFromCart`, `getMenu`, `getPage`, `getPages`, …) that return the
starter's **normalized domain types** (`Product`, `Collection`, `Cart`, `Menu`, `Page`) from
`lib/*/types`. Every UI component consumes only those normalized types. "Conform to the
provider contract" therefore means: replace `lib/shopify` with `lib/dynamicweb` implementing
the same function surface and returning the same normalized shapes.

## Decision

**Choose (a): a DynamicWeb provider module behind Vercel Commerce's data-layer contract.**

Implement `lib/dynamicweb/` exporting the same function surface as `lib/shopify/`, calling
the DW Delivery API over REST/JSON and **reshaping** DW view-models into the unchanged Vercel
Commerce domain types. Keep the starter's domain types and all presentation components
intact. Do **not** rewrite the domain layer (rejecting (b)).

### Rationale

1. **The DW surface is a clean REST/JSON fit for a reshaper, not a rewrite.** DW view-models
   (`ProductViewModel`, `ProductListViewModel`, `GroupViewModel`, `Navigation`, page models)
   map mechanically onto Vercel types. A rewrite (b) buys nothing and forfeits the starter's
   tested PLP/PDP/cart components.
2. **Maximum component reuse = fastest path to Swift parity (D3).** Option (a) leaves the
   entire UI layer untouched; only the ~15-function data module changes. Parity work (U4)
   then focuses on data mapping, not re-authoring React.
3. **Isolation of DW specifics.** All DW coupling (endpoints, view-model quirks, price/VAT
   handling, the index-query dependency) lives in one folder — easy to gate, mock, and
   evolve as the `Headless_*` baseline (D6) matures.
4. **Auth alignment.** Anonymous catalog reads match the starter's server-component fetch
   model directly; the Bearer-JWT user scope maps to the starter's session/cart flows without
   architectural change.

### Consequences

- New `lib/dynamicweb/` module (index + `types` reshapers + a thin `dwapi` fetch client with
  `NODE_TLS_REJECT_UNAUTHORIZED=0` for the self-signed dev host only).
- `DYNAMICWEB_*` env vars replace `SHOPIFY_*` (`DW_API_BASE`, `DW_SHOP_ID`, `DW_LANGUAGE_ID`,
  `DW_CURRENCY_CODE`, `DW_AREA_ID`).
- The **product-list/faceted PLP path depends on a repository Query** the harness does not yet
  provision (see Gaps). Until U3's headless baseline ships it, the provider uses the index-free
  `ProductIds`/`GroupId` paths; faceted search is deferred behind the same provider function so
  no component changes when the query lands.
- `@vercel/*` and Shopify couplings removed/kept per the section below.

## Mapping table — Vercel Commerce domain type → DW concept

| Vercel type | DW source (endpoint) | Field mapping (Vercel ← DW) |
|---|---|---|
| **Product** | `GET /ecommerce/products/{id}`, items of `ProductListViewModel.products[]` | `id ← id` (+`variantId`); `handle ← number`/slug(id); `title ← name`; `description ← shortDescription`, `descriptionHtml ← longDescription`; `priceRange.{min,max}VariantPrice ← price`/`prices[]`; `variants ← variantInfo` + `GET /variants/{id}`; `options ← variantInfo` groups; `featuredImage`/`images ← imagePatternImages`/`assetCategories`; `availableForSale ← active && (neverOutOfstock || stockLevel>0)`; `seo ← {metaTitle,metaDescription}`; `tags ← keywords`/`productFields`; `updatedAt ← updated` |
| **Collection** | `GET /ecommerce/groups`, `GET /ecommerce/groups/{groupId}` | `handle ← id` (e.g. `GROUP1`); `title ← name`; `description ← description`; `seo ← {title,metaDescription}`; `path ← '/search/'+id` (or resolve `primaryPageId` → page path); `products ← GET /ecommerce/products?GroupId=id` (index) with `ProductIds` fallback |
| **Cart** | `POST /ecommerce/carts/create`; `GET/PATCH /ecommerce/carts/{secret}`; `/{secret}/items`; `/{secret}/checkout` | `id ← secret`; `checkoutUrl ← /ecommerce/carts/{secret}/checkout`; `cost.{subtotal,total,totalTax}Amount ← cart price fields`; `lines ← order/cart lines`; `totalQuantity ← line qty sum` |
| **Menu** | `GET /frontend/navigations/{areaId}` | `Menu[] ← nodes[]` recursively → `{ title ← node.title, path ← node.link/friendlyUrl }`; root from `nodes`, active via `activeNode` |
| **Page** | `GET /content/pages`, `/pages/{id}`, `/pages/url`; body via `GET /content/rows/{pageId}/{device}` or `/content/paragraphs` | `handle ← path`; `title ← title`/`name`; `body ← rows/paragraphs` (rendered/HTML); `bodySummary ← description`; `seo ← {title,description,keywords}`; `createdAt ← createdDate`, `updatedAt ← updatedDate` |
| **(Site context)** | `GET /content/areas` | Area 3 = "Swift 2", Area 27 = "Swift 2 Nederlands". Area carries `ecomShopId`/`ecomLanguageId`/`ecomCurrencyCode` bindings used to seed the provider's `DW_*` defaults. |
| **Search / facets** | `POST /ecommerce/products` / `GET /ecommerce/products/search` (`RepositoryName`+`QueryName`, `FacetGroupNames`, `PageSize`, `CurrentPage`, `SortBy`) | `products ← ProductListViewModel.products[]`; `pageInfo ← {pageSize,pageCount,currentPage,totalProductsCount}`; facets ← `FacetGroupSettings`. **Requires a provisioned repository Query — see Gaps.** |

## `@vercel/*` and Shopify coupling disposition

The dominant coupling in the starter is **Shopify**, not `@vercel/*`. Option (a) removes it:

- **Removed:** `lib/shopify/**` (GraphQL client, queries/mutations/fragments), all `SHOPIFY_*`
  env, the Shopify webhook revalidation route (`app/api/revalidate` keyed on Shopify topics),
  and Shopify GraphQL types. Replaced by `lib/dynamicweb/**` + `DYNAMICWEB_*` env.
- **Kept (Next-native, no account needed):** on-demand ISR via `revalidateTag`/`revalidatePath`
  — these are `next/cache`, not `@vercel/*`, and work under `next start` on any Node host.
  Re-point revalidation from Shopify webhooks to a DW-driven trigger (or fall back to
  time-based `revalidate`).
- **Dropped/opt-in for self-host:** `@vercel/analytics`, `@vercel/speed-insights`, and the
  Vercel Toolbar are optional telemetry — remove them or leave them inert; none are required
  to build or to pass the Stage 1 gate.

> Note: the exact `@vercel/*` dependency list must be reconciled by `storefront-bootstrap`/U4
> against the actually-scaffolded starter `package.json`; the list above reflects the known
> `vercel/commerce` structure, since the repo was not scaffolded in this research unit.

## Evidence

Live, anonymous, against `Harness-Swift-2.3` (2052 EcomProducts):
`GET /dwapi/ecommerce/products/10001` → 200 (product "Mongoose Tyax Comp Disc (T3)", full
model incl. price block); `GET /dwapi/ecommerce/products/search?ProductIds=10001..10005` →
200 `ProductListViewModel` (5 products, `totalProductsCount`); `GET /dwapi/ecommerce/groups`
→ 200 (31 collections); `GET /dwapi/frontend/navigations/3`, `GET /dwapi/content/pages?AreaId=3`
(99 pages), `GET /dwapi/content/areas` (3 areas) all 200.

## Implementation notes (U4 — provider build, wave 2)

The `lib/dynamicweb/` provider was implemented and proven live against the harness host
(Swift 2.3, `Headless` repository, `ENU`/`SHOP1`). Shapes that diverged from the sketch above,
and the workarounds adopted, are recorded here so the mapping is reproducible.

### Product list / search — the `POST` model stays unusable; `GET /search` is canonical
`POST /dwapi/ecommerce/products` returns **400 for every probed body** (confirmed again). The
provider uses **`GET /dwapi/ecommerce/products/search`** exclusively, with
`RepositoryName=Headless&QueryName=Products` + `LanguageId`/`ShopId`/`CurrencyCode`/`CountryCode`.
Verified live params: `q` (text), `sku` (reverse-resolve a product number → id, 1 hit),
`GroupID` (collection PLP), `PageSize`/`PageIndex`, and `SortBy`+`SortOrder`
(`SortBy=Price|Created|Name`, `SortOrder=asc|desc` all sort correctly). Count path
`totalProductsCount` (378 under ENU/SHOP1). Facet options live at
`facetGroups[i].facets[j].options[]` as `{name,label,value,count,selected}`.

### Slug contract — resolve via search, reshape the hit directly
Search result items carry the **same rich view-model as product detail** (price, `variantInfo`,
`groups`), so `getProduct(handle)` does `search({sku:handle})` and reshapes `products[0]` with no
second detail call; a direct `GET /products/{handle}` is only a fallback. Handle = product
`number` per the baseline slug contract.

### Variants — nested tree, flattened by a recursive walk
`GET /dwapi/ecommerce/variants/{productId}` returns a **nested** structure: each level is a
variant group (`variantInfoGroupName`, e.g. "Colors" → "Shoe size") whose `variantInfo[]` are the
options, each carrying its own child `variantInfo[]`. The provider walks it into flat Vercel
`options[]` (group → distinct values) + `variants[]` (leaf combinations). Leaf variant id = the
DW option ids joined with `.` (matches the `variantId` shape in search, e.g. `VO3.VO49`).
Merchandise ids are encoded `productId` (simple) or `productId::variantId` (variant) and decoded
on cart writes. Proven: `PROD340` renders "Colors" + "Shoe size" with Red/Blue/Black/Green.

### Cart — full `OrderLineViewModel` required; locale params mandatory on every call
- **Create** (`POST /carts/create`) requires `LanguageId`, `ShopId`, `CurrencyCode`, **and
  `CountryCode`** as query params (a bare call 400s listing all four). Returns the cart `secret`
  (stored in the `cartId` cookie).
- **Add** (`POST /carts/{secret}/items`) requires the **full `OrderLineViewModel`** — a minimal
  `{productId,quantity}` body returns **404 "Items not found."**. The working body is
  `{productId, productVariantId:"", productLanguageId:"<lang>", quantity, unitId:""}`; the
  discriminating field is **`productLanguageId`**. `PATCH /items` (array form) returns 200 with a
  per-line `{success:false,error:"Item not found"}` for the wrong shape.
- **Update** (`PATCH /carts/{secret}/items/{lineId}`) and **remove**
  (`DELETE /carts/{secret}/items/{lineId}`) both take the line `id` (e.g. `OL2`) and return 200.
- Cart prices are **VAT-inclusive** in the cart context (`showPricesWithVat:true`), unlike the
  anonymous product detail (`false`). The provider uses the cart's own `price`/`totalTaxes`.

### Checkout — handoff-only
No hosted headless checkout page exists in the baseline. `checkoutUrl` is set to the reachable
`…/carts/{secret}/checkout` Delivery-API endpoint (exists; 400 without a checkout payload). The
storefront hands off; completing a DW order (`/carts/{secret}/createOrder`) + a checkout UI is
deferred to wave 3.

### Images — none in the catalog
All 378 products return **empty** `imagePatternImages`/`assetCategories`. The provider maps real
DW media to `/Files/**` on the host (allowed in `next.config.ts` `remotePatterns`) when present,
but falls back to a same-origin `/placeholder.svg` — which is what renders today.

### Menu — backend link paths
`GET /dwapi/frontend/navigations/{areaId}` (area 5 = `Headless`) returns recursive `nodes[]` with
`name` (title) + `link` (path). Links are DW backend paths (`/headless/*`); Next prefetch 404s on
them (cosmetic). A DW-path → storefront-route translation is a wave-3 item.

### Revalidation & Vercel couplings
The Shopify webhook route was re-pointed to `lib/dynamicweb.revalidate` (guarded by
`DW_REVALIDATION_SECRET`, tag-revalidates content); freshness otherwise rides time-based
`cacheLife` on each provider fn. No `@vercel/*` runtime deps were present in the scaffolded
`package.json`, so none needed removal — only `lib/shopify/**` + `SHOPIFY_*` env were removed.

### TLS
Self-signed dev host only: the provider sets `NODE_TLS_REJECT_UNAUTHORIZED=0` at module load when
`DW_ALLOW_SELF_SIGNED=1` (and it is exported when running dev/build/start). Never for production.

### Dev-server caveat (not a provider bug)
`next dev --turbopack` 500s on PLP/PDP with a Tailwind v4 CSS parse error — the Turbopack CSS
scanner mis-reads product-content strings in the RSC stream as arbitrary class names. The
**production build** (source-only scanner) is unaffected: `next build` passes and `next start`
serves every surface. Live parity was proven against `next start`.
