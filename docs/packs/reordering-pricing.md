# Pack as docs — `reordering-pricing`

> The Swift feature pack lives in the harness at `packs/reordering-pricing/`
> (`pack.json`, `src/ReorderingPricingQtyBreakProvider.cs`). Contract:
> `docs/pack-contract.md`. This page documents the **same behaviors** as the
> headless storefront frontend contract — it is **not** a port of the pack's C#.

## What it does in Swift

Two related B2B pricing behaviors, plus quick-order entry:

1. **Quantity-break pricing** — a `PriceProvider` (`ReorderingPricingQtyBreakProvider`)
   applies tiered unit prices as cart quantity crosses thresholds. Ships `EcomPrices`
   tier rows for product 10016 (GT Peace Single Speed): base 4995, then qty 5 → 4500,
   qty 10 → 4200, qty 25 → 3900 (`PACK-RPP-0001..0003`).
2. **Contract pricing** — a customer-number-scoped `EcomPrices` row prices product
   10002 (Scattante CFR Race) at **1399** for buyer customer number **98745621**
   (base 1599) via `PriceUserCustomerNumber` (`PACK-RPP-0004`).
3. **Quick order / express buy** — content pages (`/swift-2/quick-order`,
   `/swift-2/express-buy`) that add many SKUs in one `cartcmd=addmulti` POST.

Gate proof (Swift): `cart-price` probes assert the cart shows 1399 for 10002 and 4500
for 10016 ×5; `http-body-contains` probes assert the quick-order/express-buy forms render.

## Headless frontend contract (the same behavior, Delivery API)

| Behavior | Delivery-API expression | Storefront today |
|---|---|---|
| Contract price | `GET /dwapi/ecommerce/products/search?sku=10002` **with the buyer JWT** returns `price.price=1399` (vs 1599 anonymous). Server-side, resolved from the JWT's customer number. | **Covered** — `getUserPrice()` + PDP gating (`wave3-pdp-10002-*.png`). |
| Quantity-break price | Same catalog query carries the resolved unit price; a headless "quick order" would `addToCart` multiple lines then read back `cart.lines[].cost`. | Partial — cart mutations exist (`addToCart` addmulti-equivalent). See the cart-pricing caveat below. |
| Quick order / express buy | A multi-line add = repeated `POST /carts/{secret}/items` (the headless analog of `cartcmd=addmulti`). Reorder (customer center) is the same primitive over an order's lines. | **Covered** as **reorder** (`reorder()` copies an order's lines into the cart). A dedicated bulk SKU-entry page is the demo add. |

### Cart-pricing caveat (measured, wave 3)

The contract price is applied by the **catalog** endpoint (PDP gating works), but the
Delivery-API **cart/order** price context prices 10002 at the base 1599, not 1399 — it
does not resolve the `PriceUserCustomerNumber` row the catalog query does. In Swift the
pack's `PriceProvider` runs inside the cart pipeline, so the Swift cart shows 1399. The
headless cart would need either a server-side price hook or a cart price override to reach
full parity. Documented in the parity matrix.

## Storefront covers vs. what a demo adds

- **Covered:** per-user contract price gating on the PDP; reorder from order history
  (the addmulti primitive); the authed catalog price surface for quantity breaks.
- **A demo would add:** a bulk quick-order grid (paste SKUs → addToCart), and cart-line
  break-price display once the cart price context honors the tier/contract rows.
