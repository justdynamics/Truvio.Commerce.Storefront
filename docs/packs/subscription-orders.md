# Pack as docs — `subscription-orders`

> Swift pack: harness `packs/subscription-orders/` (`pack.json`, zero `.cs` — it is
> configuration + content only). Contract: `docs/pack-contract.md`. This documents the
> equivalent headless frontend contract, not a C# port.

## What it does in Swift

Turns a normal checkout into a **recurring order** subscription:

- A **Subscribe** content page (`/swift-2/subscribe`) whose checkout renders the native
  `EcomRecurringOrderCreate` panel. Submitting checkout with `EcomRecurringOrderCreate=True`,
  `EcomOrderRecurringInterval=1`, `EcomOrderRecurringIntervalUnit=1` (weeks) creates a
  recurring-order **template** plus the first order.
- A **Subscriptions** account page (`/swift-2/account/subscriptions`) listing the user's
  recurring orders.
- Config it relies on (not created by the pack): invoice payment `PAY2` (resolves to the
  `DefaultCheckoutHandler`, which is `IRecurring`), shipping `SHIP9`, and the native
  **"Place recurring orders"** `ScheduledTask` (auto-created at host startup; enabling it
  is a demo-time admin action).

Gate proof (Swift): the `checkout-recurring` probe places a checkout with the recurring
fields and asserts the buyer's count of `EcomRecurringOrder` rows with a non-empty
`RecurringOrderBaseOrderID` **increases** across the checkout (a before/after delta).

## Headless frontend contract (Delivery API)

DW10's Delivery API has **no first-class subscriptions/recurring endpoint** (probed live:
only `/dwapi/ecommerce/orders`, `/orders/{secret}`, `/orders/search` exist). Recurring
orders are expressed through **order fields**, not a dedicated resource:

| Behavior | Delivery-API expression | Storefront today |
|---|---|---|
| Placed order carries recurrence | Order model exposes `recurringOrderId` (0 when not recurring) — visible on `GET /orders` / `/orders/{secret}`. | Order shape is mapped; `recurringOrderId` is available to surface. |
| Create a subscription at checkout | `POST /carts/{secret}/createOrder` with a recurring payload (the headless analog of the Swift `EcomRecurringOrderCreate` + interval fields). The exact `OrderViewModel`/createOrder body for recurrence is **not documented in this baseline** and needs a spike. | **Gap** — the wave-3 checkout places a normal order; it does not set recurrence. |
| List subscriptions | `GET /orders/search` filtered to recurring templates (by `recurringOrderId` / order fields). | **Gap** — no subscriptions view yet. |

## Storefront covers vs. what a demo adds

- **Covered:** order placement via `createOrder`; order history + detail that can read
  `recurringOrderId`.
- **A demo would add:** a subscribe toggle on checkout (interval + unit) that extends the
  `createOrder` payload with the recurring fields once the Delivery-API contract for
  recurrence is confirmed, and a "My subscriptions" account view over `/orders/search`.
  Enabling the "Place recurring orders" scheduled task remains an admin action, exactly as
  in the Swift pack.
