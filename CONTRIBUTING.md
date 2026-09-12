# Contributing

`Truvio.Commerce.Storefront` is a **curated** artifact in the Truvio Commerce demo
ecosystem, maintained by JustDynamics. Pull requests are welcome — bug fixes, parity
work, provider/data-layer improvements, docs — but every change passes the same gate
before it merges. This mirrors the merge-gate discipline of the sibling `Baselines`
and `DemoThemes` repositories.

## The merge gate

A change is mergeable only when:

1. **It builds.** `pnpm install` and `pnpm build` both succeed (exit 0). Because the
   Next.js starter prerenders provider-fed pages at build time, "builds" means against
   a reachable provider endpoint (the configured DW10 backend, or — for offline CI — a
   provider stub returning HTTP 200 valid shapes). No live secrets or live endpoints are
   committed; `.env*` is gitignored.

2. **It type-checks and is formatted.** `pnpm test` (Prettier check) passes and the
   TypeScript compile inside `next build` is clean. No `any`-escapes added to the
   provider contract.

3. **The provider seam stays intact.** Changes preserve Vercel Commerce's provider
   abstraction — the data layer swaps behind the `Product`/`Collection`/`Cart`/`Menu`/
   `Page` domain types; UI/components stay provider-agnostic. Backend coupling lives in
   the provider module only.

4. **Parity is tracked.** If the change affects a storefront surface (catalog, cart/
   checkout, customer center / B2B), `docs/parity-matrix.md` is updated: Swift surface →
   headless status → gaps. Deferred gaps are recorded with rationale, not silently left.

5. **It is documented.** Architecture-affecting decisions get an ADR under `ADR/`.
   `README.md` and the relevant `docs/` pages describe **current** behavior in the
   present tense — no fix-history narration, no internal phase numbers.

6. **Ecosystem gate is green.** Changes that depend on backend/content behavior must
   keep the harness gate green: the `baseline/headless/2.4` package deserializes cleanly
   and `Invoke-Verify` stays green on the supported Swift version (2.4). Evidence lives
   in the harness `runs/`, referenced from the PR.

## Constraints (inherited standing rules)

- **Rolling latest-only Swift** support — currently Swift 2.4 (`swift/2.4` stamp). Roll
  forward when 2.4 ships; drop the prior. No multi-version matrix.
- **Zero custom backend code in the baseline.** The storefront consumes content; it does
  not require custom C#/providers in the DW10 baseline.
- **No customer or demo names** anywhere in the repo, commits, or docs.
- **Publishing is print-don't-run** and human-approved. The harness never pushes, opens
  PRs, or creates the GitHub repo autonomously.

## Conventions

- Small, atomic commits with imperative subjects.
- Release/version stamp mirrors the ecosystem: Swift target as `swift/<major.minor>`.
- Provider-specific code stays under `lib/<provider>/`; keep the default provider present
  until its replacement fully satisfies the contract.
