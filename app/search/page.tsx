import Grid from "components/grid";
import { Facets } from "components/layout/search/facets";
import ProductGridItems from "components/layout/product-grid-items";
import { defaultSort, sorting } from "lib/constants";
import { getProductsWithFacets } from "lib/dynamicweb";

export const metadata = {
  title: "Search",
  description: "Search for products in the store.",
};

export default async function SearchPage(props: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const {
    sort,
    q: searchValue,
    GroupID,
    PriceRange,
  } = searchParams as { [key: string]: string };
  const { sortKey, reverse } =
    sorting.find((item) => item.slug === sort) || defaultSort;

  const { products, facets } = await getProductsWithFacets({
    query: searchValue,
    sortKey,
    reverse,
    groupId: GroupID,
    priceRange: PriceRange,
  });
  const resultsText = products.length > 1 ? "results" : "result";

  // Flatten to the string map the facet links need to preserve state.
  const flatParams: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(searchParams || {})) {
    if (typeof v === "string") flatParams[k] = v;
  }

  return (
    <>
      {searchValue ? (
        <p className="mb-4">
          {products.length === 0
            ? "There are no products that match "
            : `Showing ${products.length} ${resultsText} for `}
          <span className="font-bold">&quot;{searchValue}&quot;</span>
        </p>
      ) : null}

      <Facets facets={facets} searchParams={flatParams} />

      {products.length > 0 ? (
        <Grid className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <ProductGridItems products={products} />
        </Grid>
      ) : (
        <p className="text-neutral-500">No products match the selected filters.</p>
      )}
    </>
  );
}
