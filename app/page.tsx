import { Carousel } from "components/carousel";
import { ThreeItemGrid } from "components/grid/three-items";
import { CategoryGrid } from "components/home/category-grid";
import { Hero } from "components/home/hero";
import { PartnerCta } from "components/home/partner-cta";
import Footer from "components/layout/footer";

export const metadata = {
  description:
    "Truvio Commerce — high-quality bikes, components and accessories for retailers and distributors. A headless storefront on Dynamicweb 10 and Next.js.",
  openGraph: {
    type: "website",
  },
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <ThreeItemGrid />
      <CategoryGrid />
      <PartnerCta />
      <Carousel />
      <Footer />
    </>
  );
}
