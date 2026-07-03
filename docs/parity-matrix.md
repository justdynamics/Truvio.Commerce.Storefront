# Swift → Headless parity matrix

Tracks each Swift storefront surface against the headless Next.js storefront
(`lib/dynamicweb/` provider over the DW10 Delivery API). Proven live against the
harness host `https://localhost:57301` (Swift 2.3 / DW 10.26.9), `Headless`
repository, `ENU`/`SHOP1`. Evidence: `docs/evidence/wave2/` (catalog + cart),
`docs/evidence/wave3/` (B2B / customer center / price gating / checkout).

Legend: ✅ at parity · ◐ partial (works, with a documented gap) · ⏳ pending (later wave).

| Swift surface | Headless status | Provider fn(s) | Proof | Gaps |
|---|---|---|---|---|
| **Catalog — home** | ✅ | `getCollections`, `getCollectionProducts` | Home renders real DW collections + featured products (links `/product/10070,10153,194647`; 3 collection links). `home.html`, `home.png` | Featured picks = first N of unfiltered search (no curated "hidden-homepage" group in baseline). |
| **Catalog — PLP (collection)** | ✅ | `getCollection`, `getCollectionProducts` (`GroupID`) | `/search/GROUP136` → title "Glove", 3 products (10152/10153/10154). `plp-collection-gloves.{html,png}` | — |
| **Catalog — PLP (all)** | ✅ | `getProducts` | `/search` → 68 unique product tiles. `plp-all.html` | Page size capped at 100/req; UI has no infinite-scroll paging yet. |
| **Catalog — search (text)** | ✅ | `getProducts` (`q`) | `/search?q=glove` → "Showing 3 results for glove". `search-glove.html` | — |
| **Catalog — faceted nav** | ✅ | `getProductsWithFacets`, `Facets` component | `/search` renders Group + Price facet chips; `/search?GroupID=GROUP136` filters to 3 products. `wave3-facets.png` | Manufacturer facet optCount=0 (no manufacturer rows in the ENU set) so it is hidden; single-select per facet. |
| **Catalog — PDP** | ✅ | `getProduct` (slug=`number` via `sku`) | `/product/10153` → title, €38.75, full description, SEO, JSON-LD. `pdp-10153.html` | — |
| **Catalog — PDP price gating** | ✅ | `getUserPrice` (authed search) | 10002 anon **€1,998.75** vs signed-in **€1,748.75** (contract 1399 incl. VAT) + "Your contract price" note. `wave3-pdp-10002-anon.png`, `wave3-pdp-10002-gated.png` | Catalog/PDP gating only; the Delivery-API **cart/order** price context does not apply the customer-number contract row (prices at base). See §Honest gaps. |
| **Catalog — PDP variants** | ◐ | `getProduct` + `/variants/{id}` tree walk | `/product/PROD340` → options "Colors" + "Shoe size", values Black/Blue/Green/Red; `variant-selector` renders. `pdp-variant-prod340.html` | Full leaf-combo availability/price depth not verified for every matrix; leaf price falls back to product price when the variant node price is 0. |
| **Catalog — product images** | ◐ | `productImages` | Placeholder renders (same-origin `/placeholder.svg`). | **Catalog ships zero images** (all 378 products: `imagePatternImages`/`assetCategories` empty). Real image mapping coded (DW `/Files/**`) but unexercised — no data. |
| **Cart — create** | ✅ | `createCart` | `POST /carts/create` (locale params) → secret; cookie `cartId`. | Requires `LanguageId`+`ShopId`+`CurrencyCode`+`CountryCode` (see ADR-001 impl notes). |
| **Cart — add** | ✅ | `addToCart` | In-browser: Add To Cart on 10155 → line qty 1, €75.00, Total €75.00. `cart-01-added.png` | Add requires the **full** `OrderLineViewModel` incl. `productLanguageId` (a partial body 404s — see ADR-001 impl notes). |
| **Cart — update qty** | ✅ | `updateCart` (`PATCH /items/{id}`) | Increase → qty 2, line/total €150.00. `cart-02-qty2.png` | — |
| **Cart — remove** | ✅ | `removeFromCart` (`DELETE /items/{id}`) | Remove → "Your cart is empty." `cart-03-empty.png` | — |
| **Cart — persistence** | ✅ | `getCart` (cookie secret) | All ops target the same cart via the `cartId` cookie secret across requests. | Anonymous cart only so far; binding to an authenticated user pending JWT session (wave 3). |
| **Checkout** | ✅ | `placeOrder` (`/carts/{secret}/createOrder`), `/checkout`, confirmation | Signed-in checkout: shipping form prefilled from profile → **real DW order ORDER3** created, confirmation page with order id + lines. `wave3-checkout-form.png`, `wave3-order-confirmation.png` | Single-step checkout (no payment-gateway / shipping-method selection UI); order prices at base list (same cart-context caveat as price gating). |
| **Menu / navigation** | ✅ | `getMenu` + `translateNavPath` | Header links translated: `/headless/catalog`→`/search`, `/headless/about`→`/about`, Home→`/`, etc. No more backend `/headless/*` prefetch 404s. | Heuristic translation (catalog-ish → `/search`, else last-slug content page); deep content-page bodies still summary-only. |
| **Content pages** | ◐ | `getPage`, `getPages` | `getPage` resolves via `/content/pages/url`; `getPages` returns `[]` (no flat index in baseline). | Page body is `description` only; rich rows/paragraphs (`/content/rows/{id}/{device}`) not yet mapped. |
| **Auth / session** | ✅ | `lib/dynamicweb/auth.ts`, `/login`, `AccountNav` | Login mints JWT (`POST /dwapi/users/authenticate`), httpOnly `dwToken` cookie, Bearer threaded on user-scoped calls; logout clears it. `wave3-account-buyer.png` | Access-token TTL ~30 min; `/authenticate/refresh` exists but auto-refresh not wired (re-login on expiry). |
| **Customer center — profile / addresses** | ✅ | `getUserInfoByToken`, `getAddresses` | `/account` shows profile (customer 98745621) + address. `wave3-account-buyer.png` | Read-only (no profile/address edit); `getAddresses` returns `[]` in this DB (falls back to the profile address). |
| **Customer center — order history + detail** | ✅ | `getOrders`, `getOrder` (by **secret**) | 2 seeded orders listed; `/account/orders/{secret}` shows lines + totals. `wave3-order-detail.png` | Order detail is keyed by `secret`, not the display id. |
| **Customer center — reorder** | ✅ | `reorder` (order lines → cart) | Reorder from ORDER2 → lines copied to cart, success banner. `wave3-reorder-success.png` | Adds base products; variant re-selection not carried. |
| **B2B — CSR impersonation** | ✅ | `getImpersonatees`, `impersonate`, `stopImpersonation`, `ActingBanner` | CSR IMCSalesrep → picker lists buyer → impersonate → acting-as banner + buyer's orders/identity; un-impersonate returns to CSR. `wave3-csr-picker.png`, `wave3-csr-impersonating.png` | Impersonation right seeded via `AccessUserSecondaryRelation` (CSR→buyer). Effective token drives all user-scoped calls, incl. price gating. |
| **Feature packs as docs** | ✅ | `docs/packs/*.md` | [`reordering-pricing`](packs/reordering-pricing.md), [`subscription-orders`](packs/subscription-orders.md), [`bom-configurator`](packs/bom-configurator.md) — each: Swift behavior, headless Delivery-API contract, storefront coverage vs. demo gap; cross-referenced to harness `packs/**` + `pack-contract.md`. | Docs, not ports. Subscription create + BOM configurator UI are documented gaps (see each page). |

## Wave 3 — resolved

Auth/session, customer center (profile/addresses/orders/detail/reorder), CSR impersonation,
PDP price gating, headless checkout + real order placement, facet UI, and menu path
translation all landed and are proven in `docs/evidence/wave3/`. Feature packs are documented
in `docs/packs/`.

## Honest gaps carried forward (wave 4 / demo)

1. **Cart/order price context ignores the customer-number contract price.** PDP gating shows
   the contract price (catalog endpoint resolves it from the JWT), but the Delivery-API
   **cart/order** price context prices at base list — it does not apply the
   `PriceUserCustomerNumber` row the way the catalog query does (measured: 10002 cart/order
   = 1599, catalog = 1399). Order binding to the buyer is correct; only the unit price differs.
   In Swift the `reordering-pricing` `PriceProvider` runs inside the cart pipeline, so the
   Swift cart shows 1399. Reaching cart parity needs a server-side price hook or a cart price
   override. Root cause is the DW Delivery-API cart pricing model, not the storefront.
2. **No product imagery in the data.** All 378 products carry empty
   `imagePatternImages`/`assetCategories` (re-confirmed for 10002 in wave 3); the storefront
   renders a same-origin placeholder. Real-image mapping (`/Files/**`) is coded but has no
   data to exercise. A demo baseline shipping catalog media closes this.
3. **Read-only customer center.** Profile/address **edit** and address CRUD are not wired
   (reads only). `getAddresses` returns `[]` in this baseline DB (profile address is shown).
4. **Subscription create + BOM configurator UI** are documented pack gaps (see
   `docs/packs/subscription-orders.md`, `docs/packs/bom-configurator.md`): the Delivery API
   exposes no first-class recurring endpoint (recurrence rides order fields) and no BOM parent
   exists in the headless baseline yet.
5. **Token refresh.** JWT ~30 min TTL; `/authenticate/refresh` exists but auto-refresh is
   not wired — the session expires to a re-login rather than refreshing silently.
6. **Deep content-page bodies** remain summary-only (rows/paragraphs not mapped) — unchanged
   from wave 2.
