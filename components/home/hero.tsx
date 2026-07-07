import Link from "next/link";

// Static, brand-appropriate hero copy for the B2B bike distributor storefront.
// (The DW Home page exposes only a short `description` over the Delivery API —
// no rich body — so the marketing copy lives here; see CUSTOMISATIONS.md.)
export function Hero() {
  return (
    <section className="mx-auto max-w-(--breakpoint-2xl) px-4 pt-4">
      <div className="relative overflow-hidden rounded-lg border border-neutral-200 bg-neutral-900 px-6 py-16 sm:px-12 sm:py-24 dark:border-neutral-800">
        {/* Decorative gradient wash — no external assets (CSP/host-safe). */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-700/40 via-neutral-900 to-black"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-blue-600/30 blur-3xl"
        />
        <div className="relative max-w-2xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-blue-300">
            For retailers &amp; distributors
          </p>
          <h1 className="text-4xl font-bold leading-tight text-white sm:text-5xl">
            Built for performance, backed by reputation
          </h1>
          <p className="mt-5 text-lg text-neutral-300">
            High-quality bikes, components and accessories — the full catalogue,
            delivered headless over the Dynamicweb Delivery API. From road to
            trail, products your customers can rely on.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/search"
              className="rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
            >
              Browse the catalogue
            </Link>
            <Link
              href="/search/GROUP130"
              className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Explore e-bikes
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
