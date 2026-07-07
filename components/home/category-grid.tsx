import { getCollectionProducts } from "lib/dynamicweb";
import Image from "next/image";
import Link from "next/link";

// Curated top-level categories with real DW group IDs (verified against the
// SHOP1 catalogue). Kept as a small, stable set for the homepage; the full
// group hierarchy drives the /search sidebar and collections nav.
const CATEGORIES: { id: string; title: string }[] = [
  { id: "GROUP130", title: "E-bikes" },
  { id: "GROUP2", title: "Mountain bikes" },
  { id: "GROUP5", title: "Road bikes" },
  { id: "GROUP46", title: "Components" },
  { id: "GROUP156", title: "Accessories" },
  { id: "GROUP9", title: "Clothing" },
];

async function categoryImage(id: string): Promise<string | undefined> {
  // Representative image = the first imaged product in the group (the provider
  // already filters imageless products out).
  const products = await getCollectionProducts({ collection: id });
  return products[0]?.featuredImage?.url;
}

async function CategoryCard({ id, title }: { id: string; title: string }) {
  const img = await categoryImage(id);
  return (
    <Link
      href={`/search/${id}`}
      className="group relative flex aspect-square items-end overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-black"
    >
      {img ? (
        <Image
          src={img}
          alt={title}
          fill
          sizes="(min-width: 768px) 33vw, 50vw"
          className="object-contain p-6 transition duration-300 ease-in-out group-hover:scale-105"
        />
      ) : null}
      <div className="relative z-10 w-full bg-gradient-to-t from-black/70 to-transparent p-4">
        <span className="text-lg font-semibold text-white">{title}</span>
      </div>
    </Link>
  );
}

export function CategoryGrid() {
  return (
    <section className="mx-auto max-w-(--breakpoint-2xl) px-4 py-8">
      <div className="mb-6 flex items-baseline justify-between">
        <h2 className="text-2xl font-bold">Shop by category</h2>
        <Link
          href="/search"
          className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          View all
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {CATEGORIES.map((c) => (
          <CategoryCard key={c.id} id={c.id} title={c.title} />
        ))}
      </div>
    </section>
  );
}
