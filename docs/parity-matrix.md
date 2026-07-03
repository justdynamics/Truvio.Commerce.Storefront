# Swift → Headless parity matrix

Tracks each Swift storefront surface against the headless Next.js storefront
(`lib/dynamicweb/` provider over the DW10 Delivery API). Proven live against the
harness host `https://localhost:57301` (Swift 2.3 / DW 10.26.9), `Headless`
repository, `ENU`/`SHOP1`. Evidence: `docs/evidence/wave2/`.

Legend: ✅ at parity · ◐ partial (works, with a documented gap) · ⏳ pending (later wave).

| Swift surface | Headless status | Provider fn(s) | Proof | Gaps |
|---|---|---|---|---|
| **Catalog — home** | ✅ | `getCollections`, `getCollectionProducts` | Home renders real DW collections + featured products (links `/product/10070,10153,194647`; 3 collection links). `home.html`, `home.png` | Featured picks = first N of unfiltered search (no curated "hidden-homepage" group in baseline). |
| **Catalog — PLP (collection)** | ✅ | `getCollection`, `getCollectionProducts` (`GroupID`) | `/search/GROUP136` → title "Glove", 3 products (10152/10153/10154). `plp-collection-gloves.{html,png}` | — |
| **Catalog — PLP (all)** | ✅ | `getProducts` | `/search` → 68 unique product tiles. `plp-all.html` | Page size capped at 100/req; UI has no infinite-scroll paging yet. |
| **Catalog — search (text)** | ✅ | `getProducts` (`q`) | `/search?q=glove` → "Showing 3 results for glove". `search-glove.html` | — |
| **Catalog — faceted nav** | ◐ | search `facetGroups` (Group/Price/Manufacturer) | Delivery API returns 3 facet groups (Group optCount 103, Price 4). Provider fetches them. | Facet UI not wired into the starter's search page (starter ships sort-only). Manufacturer facet optCount=0 (no manufacturer rows in ENU set). |
| **Catalog — PDP** | ✅ | `getProduct` (slug=`number` via `sku`) | `/product/10153` → title, €38.75, full description, SEO, JSON-LD. `pdp-10153.html` | Price is anonymous list price incl. VAT; no per-user price gating yet (wave 3). |
| **Catalog — PDP variants** | ◐ | `getProduct` + `/variants/{id}` tree walk | `/product/PROD340` → options "Colors" + "Shoe size", values Black/Blue/Green/Red; `variant-selector` renders. `pdp-variant-prod340.html` | Full leaf-combo availability/price depth not verified for every matrix; leaf price falls back to product price when the variant node price is 0. |
| **Catalog — product images** | ◐ | `productImages` | Placeholder renders (same-origin `/placeholder.svg`). | **Catalog ships zero images** (all 378 products: `imagePatternImages`/`assetCategories` empty). Real image mapping coded (DW `/Files/**`) but unexercised — no data. |
| **Cart — create** | ✅ | `createCart` | `POST /carts/create` (locale params) → secret; cookie `cartId`. | Requires `LanguageId`+`ShopId`+`CurrencyCode`+`CountryCode` (see ADR-001 impl notes). |
| **Cart — add** | ✅ | `addToCart` | In-browser: Add To Cart on 10155 → line qty 1, €75.00, Total €75.00. `cart-01-added.png` | Add requires the **full** `OrderLineViewModel` incl. `productLanguageId` (a partial body 404s — see ADR-001 impl notes). |
| **Cart — update qty** | ✅ | `updateCart` (`PATCH /items/{id}`) | Increase → qty 2, line/total €150.00. `cart-02-qty2.png` | — |
| **Cart — remove** | ✅ | `removeFromCart` (`DELETE /items/{id}`) | Remove → "Your cart is empty." `cart-03-empty.png` | — |
| **Cart — persistence** | ✅ | `getCart` (cookie secret) | All ops target the same cart via the `cartId` cookie secret across requests. | Anonymous cart only so far; binding to an authenticated user pending JWT session (wave 3). |
| **Checkout** | ◐ handoff-only | `reshapeCart.checkoutUrl` | `checkoutUrl` → reachable `…/carts/{secret}/checkout` Delivery-API endpoint (exists; 400 without checkout payload). | **No hosted headless checkout page** in the baseline. Storefront hands off; it does not complete a DW order. Real order placement (`/carts/{secret}/createOrder`) + a checkout UI = wave 3. |
| **Menu / navigation** | ◐ | `getMenu` (`/frontend/navigations/{areaId}`) | Header + footer render real DW nodes: Navigation/Home/About/Customer center/Catalog. | DW node `link` values are backend paths (`/headless/*`) → Next RSC prefetch 404s (cosmetic). Needs a DW-path → storefront-route translation. |
| **Content pages** | ◐ | `getPage`, `getPages` | `getPage` resolves via `/content/pages/url`; `getPages` returns `[]` (no flat index in baseline). | Page body is `description` only; rich rows/paragraphs (`/content/rows/{id}/{device}`) not yet mapped. |
| **Customer center / B2B** | ⏳ wave 3 | — | — | Orders, reorder, addresses, CSR impersonation, price/permission gating all require a **frontend user JWT session** (`POST /dwapi/users/authenticate`) + impersonation (`/users/impersonatees`,`/users/impersonate`). Not started; no session layer in the provider yet. |
| **Feature packs as docs** | ⏳ wave 3 | — | — | `reordering-pricing`, `subscription-orders`, `bom-configurator` to be represented as storefront doc pages describing the frontend contract + DW data consumed. |

## Honest gaps carried into wave 3

1. **Auth/session layer absent.** Everything user-scoped (customer center, B2B, per-user
   pricing, reorder, impersonation) needs the `Authorization: Bearer <jwt>` flow wired into
   the provider (login → cookie/session → attach to Delivery-API calls). Test buyer exists
   (`IMCUser`) but is used only via runtime env, never committed.
2. **Price gating is anonymous-only.** All prices shown are the anonymous list price
   (VAT-inclusive from the cart context). No user/customer-group price resolution yet.
3. **Checkout is handoff-only.** No headless checkout page; cart hands off to the
   Delivery-API checkout endpoint. Completing a DW order is unbuilt.
4. **Facet UI unwired.** The provider surfaces facet groups; the starter's search page has
   no facet controls. Wiring the facet params (`GroupID`/`PriceRange`/`Manufacturer`) into
   the PLP UI is outstanding.
5. **No product imagery in the data.** Placeholder everywhere until the catalog carries
   assets (or a media source is mapped).
6. **Menu path translation.** DW `/headless/*` node links need mapping to storefront routes
   to stop cosmetic prefetch 404s.
