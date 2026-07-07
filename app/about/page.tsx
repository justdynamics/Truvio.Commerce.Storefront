import { PartnerCta } from "components/home/partner-cta";
import Footer from "components/layout/footer";
import Link from "next/link";

export const metadata = {
  title: "About",
  description:
    "Truvio Commerce is a B2B bike solutions partner — high-quality bikes, components and accessories for retailers and distributors, delivered as a headless storefront on Dynamicweb 10 and Next.js.",
};

const PILLARS = [
  {
    title: "Quality",
    body: "Every product is sourced from trusted manufacturers who share our commitment to excellence — bikes and parts your customers can rely on, ride after ride.",
  },
  {
    title: "Sustainability",
    body: "We favour environmentally responsible practices across materials and packaging, and partners who take the long view on the products they put on the road.",
  },
  {
    title: "Customer focus",
    body: "We take the time to understand each partner's business and provide tailored solutions — contract pricing, fast reordering, and support built for the trade.",
  },
];

const STATS = [
  { value: "500,000+", label: "shoppers served" },
  { value: "4,500+", label: "cities reached" },
  { value: "650+", label: "retail brands" },
];

export default function AboutPage() {
  return (
    <>
      <div className="mx-auto max-w-(--breakpoint-2xl) px-4 py-8">
        {/* Intro */}
        <section className="max-w-3xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            About Truvio Commerce
          </p>
          <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
            A bike solutions partner built for the trade
          </h1>
          <p className="mt-6 text-lg text-neutral-600 dark:text-neutral-400">
            Truvio Commerce empowers retailers, distributors and cycling
            enthusiasts with the best products in the industry — a comprehensive
            catalogue of e-bikes, traditional bikes, apparel, components and
            accessories, delivered headless over the Dynamicweb Delivery API.
          </p>
        </section>

        {/* What we sell */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold">What we offer</h2>
          <p className="mt-3 max-w-3xl text-neutral-600 dark:text-neutral-400">
            Six categories cover everything from the frame up: e-bikes and
            traditional bikes; apparel including jerseys, jackets, shorts and
            shoes; components such as frames, forks, cranks and saddles;
            accessories from helmets to lights, locks and glasses; plus a
            rotating sale.
          </p>
          <Link
            href="/search"
            className="mt-5 inline-block rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
          >
            Browse the catalogue
          </Link>
        </section>

        {/* Pillars */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold">What we stand for</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {PILLARS.map((p) => (
              <div
                key={p.title}
                className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-black"
              >
                <h3 className="text-lg font-semibold">{p.title}</h3>
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                  {p.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Scale */}
        <section className="mt-12 rounded-lg border border-neutral-200 bg-neutral-50 px-6 py-10 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="grid gap-6 sm:grid-cols-3">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {s.value}
                </div>
                <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <PartnerCta />
      <Footer />
    </>
  );
}
