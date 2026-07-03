# Pack as docs — `bom-configurator`

> Swift pack: harness `packs/bom-configurator/` (`pack.json`, zero `.cs` — item types +
> content + a Rule-B BOM product). Contract: `docs/pack-contract.md`. This documents the
> headless frontend contract, not a C# port.

## What it does in Swift

A **kit / bill-of-materials configurator**: a parent product built from selectable child
slots (BOM items).

- Ships a Rule-B parent product `PACK-BOM-0001` (ProductType 2, number `10004kit`) and BOM
  slots in `EcomProductItems`:
  - `PACK-BOM3-0002` — slot "Forks" (GROUP49, default 10028) on the kit parent,
  - `PACK-BOM3-0003` — slot "Racks" (GROUP161, default 10119) on the kit parent,
  - `PACK-BOM3-0001` — a single-group slot on base product PROD290.
- A **Kit Configurator** content page (`/swift-2/kit-configurator`) renders the stock
  `Swift-v2_ProductBom` component: one radio group per slot (`name` = the slot's
  `ProductItemId`), the default option preselected.
- Adding to cart (`cartcmd=add` with one `<slot>=<product>` field per selection) creates
  the parent order line plus one **BOM child line per slot** (`OrderLineBOM=1`,
  `OrderLineBOMItemId` = the slot id, `OrderLineParentLineId` = the parent line).

Gate proof (Swift): the `bom-cart-lines` probe adds the kit with two non-default selections
(Forks→10007, Racks→10118) and asserts two BOM child lines land carrying the right
`OrderLineBOMItemId`/`OrderLineProductId`. (`renderProof:false` — the harness clean-room
does not provision the storefront product-catalog index, so the render is a real-host UAT.)

## Headless frontend contract (Delivery API)

| Behavior | Delivery-API expression | Storefront today |
|---|---|---|
| Read the kit's slots | `GET /dwapi/ecommerce/products/{id}/bom` returns the BOM structure for a BOM-type product (verified live: the endpoint exists; it 404s for non-BOM products like 10002, so it is BOM-product-scoped). | **Gap** — `getProductBom()` not implemented; no BOM parent in the clean-room baseline. |
| Configure + add the kit | Render one selector per slot, then `POST /carts/{secret}/items` for the parent with the chosen child products (the headless analog of `cartcmd=add` + per-slot fields). | Partial — the cart add primitive exists; slot fields on the add body are the extension. |
| Show BOM child lines | Cart/order lines carry `bomOrderLines` (present in the order-line model) — the child components under the parent line. | Order-line shape is mapped; `bomOrderLines` is available to render. |

## Storefront covers vs. what a demo adds

- **Covered:** the cart add + order-line primitives; the order-line model already exposes
  `bomOrderLines` for rendering the configured components.
- **A demo would add:** a `getProductBom()` provider fn over `/products/{id}/bom`, a PDP
  configurator UI (one selector per slot, defaults preselected), an add-to-cart that posts
  the per-slot child selections, and cart/confirmation rendering of the nested
  `bomOrderLines`. This needs a BOM parent product in the headless baseline (the Swift pack
  seeds one; the headless baseline does not yet).
