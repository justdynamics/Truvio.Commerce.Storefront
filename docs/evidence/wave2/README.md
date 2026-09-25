# Wave 2 live parity evidence

> **2026-09-25 note:** this record captures a DW 10.26.9 / Swift 2.3 run, taken before the
> 10.28.1 floor. It is kept as history, not current proof.

Storefront (`next start`, prod build) driven against the harness DW10 host
`https://localhost:57301` (Swift 2.3 / DW 10.26.9, `Headless` repository, `ENU`/`SHOP1`).
All HTTP `200`. Captured 2026-07-03.

## Read surfaces (page source)

| File                                  | URL                | What it proves                                                                      |
| ------------------------------------- | ------------------ | ----------------------------------------------------------------------------------- |
| `home.html` / `home.png`              | `/`                | Real DW collections + featured products (product links 10070/10153/194647).         |
| `plp-all.html`                        | `/search`          | 68 unique product tiles from the `Products` query.                                  |
| `plp-collection-gloves.html` / `.png` | `/search/GROUP136` | Collection PLP filtered by `GroupID` → 3 gloves (10152/10153/10154); title "Glove". |
| `search-glove.html`                   | `/search?q=glove`  | Text search → "Showing 3 results for glove".                                        |
| `pdp-10153.html`                      | `/product/10153`   | PDP: title "Adidas adiStar Glove", €38.75, description, SEO, JSON-LD.               |
| `pdp-variant-prod340.html`            | `/product/PROD340` | Variant PDP: options "Colors" + "Shoe size" (Black/Blue/Green/Red).                 |

## Cart lifecycle (in-browser, Playwright, product 10155)

| File                | Step              | Result                             |
| ------------------- | ----------------- | ---------------------------------- |
| `cart-01-added.png` | Add To Cart       | Line qty 1 · €75.00 · Total €75.00 |
| `cart-02-qty2.png`  | Increase quantity | qty 2 · line/total €150.00         |
| `cart-03-empty.png` | Remove item       | "Your cart is empty."              |

Cart identity persists across requests via the `cartId` cookie (DW cart `secret`).
Checkout `checkoutUrl` points at the reachable Delivery-API checkout endpoint (handoff-only).

## Build

`next build` exits 0 with build-time RSC fetches hitting the live host (11 static/partial
pages generated). See the provider under `lib/dynamicweb/`.
