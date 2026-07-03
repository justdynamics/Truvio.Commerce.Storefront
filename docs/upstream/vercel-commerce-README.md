# Upstream reference: Vercel Commerce README

This is the original `README.md` from the `vercel/commerce` starter this repository
was scaffolded from (see `ADR/ADR-000-starting-point.md`). It is kept verbatim for
reference — notably its **provider list** (the set of commerce backends that have
published a provider behind the Vercel Commerce provider interface) and its
**Vercel deploy/run instructions**. The root `README.md` documents the Truvio
ecosystem instead.

---

A high-performance, server-rendered Next.js App Router ecommerce application.

This template uses React Server Components, Server Actions, `Suspense`,
`useOptimistic`, and more.

## Providers

Vercel actively maintains only a **Shopify** version. Alternative providers fork
the repository and swap out the `lib/shopify` implementation while leaving the rest
of the template mostly unchanged. Published provider forks at scaffold time included:
Shopify (default), BigCommerce, Ecwid, Geins, Medusa, Prodigy, Saleor, Shopware,
Swell, Umbraco, Wix, and Fourthwall.

> The provider-swap contract ("swap out `lib/shopify` with your own implementation,
> leave the rest unchanged") is exactly the seam the Truvio DynamicWeb 10 provider
> will occupy — see `ADR/ADR-000-starting-point.md` §D2 hand-off.

## Running locally (upstream instructions)

The upstream flow uses the Vercel CLI (`vercel link`, `vercel env pull`) to hydrate
`.env`, then `pnpm install && pnpm dev`. A plain `.env` file is all that is actually
required — see the root `README.md` and `.env.example` for the Truvio placeholder set.
No Vercel account is required to build or run (per STOREFRONT-PHASE §0.5).
