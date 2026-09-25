# Wave 3 evidence — B2B customer center, price gating, CSR impersonation, checkout

> **2026-09-25 note:** this record captures a DW 10.26.9 / Swift 2.3 run, taken before the
> 10.28.1 floor. It is kept as history, not current proof.

Proven live against the harness DW10 host `https://localhost:57301` (DW 10.26.9,
`Harness-Swift-2.3`) with the Next.js storefront running via `next start` on
`http://localhost:3000` (production build — the `next dev --turbopack` CSS caveat
from ADR-001 does not affect `next start`). Captured 2026-07-03.

## Surfaces proven

| Surface                                               | Evidence                                                          | Result                                                                                                                                     |
| ----------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Auth / session                                        | login form → `/account` redirect (all screenshots are post-login) | JWT minted at `POST /dwapi/users/authenticate`, stored httpOnly cookie `dwToken`, threaded as `Authorization: Bearer` on user-scoped calls |
| Customer center — profile + addresses + order history | `wave3-account-buyer.png`                                         | Profile (customer 98745621), 2 seeded orders (ORDER1, ORDER2), CSR panel correctly inert for a buyer                                       |
| Order detail                                          | `wave3-order-detail.png`                                          | ORDER2, 2 lines, Reorder button                                                                                                            |
| Reorder                                               | `wave3-reorder-success.png`                                       | Order lines copied into the cart; success banner                                                                                           |
| **Price gating (anon)**                               | `wave3-pdp-10002-anon.png`                                        | Product 10002 → **€1,998.75** (list 1599 incl. VAT), no contract note                                                                      |
| **Price gating (signed in)**                          | `wave3-pdp-10002-gated.png`                                       | Product 10002 → **€1,748.75** (contract 1399 incl. VAT), "Your contract price" note, list struck through                                   |
| CSR impersonation — picker                            | `wave3-csr-picker.png`                                            | Signed in as CSR (IMCSalesrep); picker lists managed buyer IMC User (98745621)                                                             |
| CSR impersonation — acting                            | `wave3-csr-impersonating.png`                                     | Amber acting-as banner; effective identity = buyer (orders + customer number surface); un-impersonate returns to CSR                       |
| Checkout — form                                       | `wave3-checkout-form.png`                                         | Shipping form prefilled from profile; order summary                                                                                        |
| Checkout — order placed                               | `wave3-order-confirmation.png`                                    | Real DW order **ORDER3** created via `POST /carts/{secret}/createOrder`, confirmation with order id + lines                                |
| Faceted search                                        | `wave3-facets.png`                                                | Group + Price facet chips from the Delivery-API `facetGroups`; `/search?GroupID=GROUP136` filters to 3 products                            |

## Seeding log (throwaway harness DB `Harness-Swift-2.3`)

All seeding was SQL against `localhost\SQLEXPRESS`, DB `Harness-Swift-2.3`, following
the canonical `tools/harness/Invoke-SeedGating.ps1` pattern (AccessUser rows, plaintext
`AccessUserPassword` — DW accepts the legacy form). **The host was restarted after
seeding** because DW caches identity state at startup.

1. **Buyer** — `AccessUser` id 1328, `AccessUserType=5`, username `IMCUser`,
   customer number `98745621`, password `Demo!Passw0rd`, full profile address
   (742 Evergreen Terrace, 62704 Springfield), `AccessUserShopId=SHOP1`.
2. **CSR** — `AccessUser` id 1326, `AccessUserType=5`, username `IMCSalesrep`,
   customer number `7789765`, password `Demo!Passw0rd`.
3. **Group membership** — `AccessUserGroupRelation`: 1328→1325 (Customers),
   1326→1292 (CSR). Groups 1325/1270/1292 already present in the clean-room DB.
4. **Impersonation right** — `AccessUserSecondaryRelation(UserId=1326,
SecondaryUserId=1328)` so the CSR may impersonate the buyer
   (`GET /dwapi/users/impersonatees` returns the buyer for the CSR token).
5. **Contract price** — `EcomPrices` row `WAVE3-CONTRACT-98745621-10002`: product
   10002, `PriceAmount=1399`, `PriceCurrency=EUR`, `PriceShopId=SHOP1`,
   `PriceUserCustomerNumber=98745621`, `PriceCustomerGroupId=''` (customer-number
   scoped, matches the reordering-pricing pack's `PACK-RPP-0004` intent). Base list
   price on the product row is 1599.
6. **Orders** — 2 orders placed via the Delivery API as the buyer (cart→createOrder):
   ORDER1 (10002 ×1), ORDER2 (10016 ×2 + 10153 ×1). ORDER3 was placed live from the
   storefront checkout during this evidence run.

The seed SQL is in the session scratchpad (`seed-wave3.sql`); it is **not** committed
(throwaway DB state, and it embeds a demo password). No credentials are committed to
the repo; runtime config lives in the gitignored `.env`.

## Key finding — cart/order pricing vs catalog pricing

The customer-number contract price (1399) is applied by the **catalog** endpoints
(`/dwapi/ecommerce/products/search` with the buyer JWT → 1399) and therefore by the
PDP price gating. It is **not** applied by the **cart/order** price context: an authed
cart/order for 10002 prices at the base 1599 (1998.75 incl. VAT). The Delivery-API
cart price context does not resolve the `PriceUserCustomerNumber`-scoped row the way
the catalog query does. Order placement still binds correctly to the buyer
(`customerUserId=1328`, `customerNumber=98745621`); only the unit price differs. This
is a documented Delivery-API behavior, not a storefront bug — see the parity matrix.
