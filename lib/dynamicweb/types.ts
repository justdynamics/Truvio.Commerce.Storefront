// Normalized domain types consumed by the storefront UI.
// These are the SAME shapes the components imported from `lib/dynamicweb/types`
// (Product, Collection, Cart, Menu, Page, …). The DynamicWeb provider reshapes
// DW Delivery-API view-models into exactly these types, so no component changes.

export type Maybe<T> = T | null;

export type Connection<T> = {
  edges: Array<Edge<T>>;
};

export type Edge<T> = {
  node: T;
};

export type Money = {
  amount: string;
  currencyCode: string;
};

export type SEO = {
  title: string;
  description: string;
};

export type Image = {
  url: string;
  altText: string;
  width: number;
  height: number;
};

export type Menu = {
  title: string;
  path: string;
};

export type ProductOption = {
  id: string;
  name: string;
  values: string[];
};

export type ProductVariant = {
  id: string;
  title: string;
  availableForSale: boolean;
  selectedOptions: {
    name: string;
    value: string;
  }[];
  price: Money;
};

// Base product shape (DW-reshaped). Mirrors the starter's `ShopifyProduct`.
export type BaseProduct = {
  id: string;
  handle: string;
  availableForSale: boolean;
  title: string;
  description: string;
  descriptionHtml: string;
  options: ProductOption[];
  priceRange: {
    maxVariantPrice: Money;
    minVariantPrice: Money;
  };
  featuredImage: Image;
  seo: SEO;
  tags: string[];
  updatedAt: string;
};

export type Product = BaseProduct & {
  variants: ProductVariant[];
  images: Image[];
};

export type Collection = {
  handle: string;
  title: string;
  description: string;
  seo: SEO;
  updatedAt: string;
  path: string;
};

export type Page = {
  id: string;
  title: string;
  handle: string;
  body: string;
  bodySummary: string;
  seo?: SEO;
  createdAt: string;
  updatedAt: string;
};

export type CartProduct = {
  id: string;
  handle: string;
  title: string;
  featuredImage: Image;
};

export type CartItem = {
  id: string | undefined;
  quantity: number;
  cost: {
    totalAmount: Money;
  };
  merchandise: {
    id: string;
    title: string;
    selectedOptions: {
      name: string;
      value: string;
    }[];
    product: CartProduct;
  };
};

export type Cart = {
  id: string | undefined;
  checkoutUrl: string;
  cost: {
    subtotalAmount: Money;
    totalAmount: Money;
    totalTaxAmount: Money;
  };
  lines: CartItem[];
  totalQuantity: number;
};

// --- B2B / customer-center domain types (DW user-scoped Delivery API) --------

export type OrderLine = {
  id: string;
  productId: string;
  productNumber: string;
  productName: string;
  quantity: number;
  unitPrice: Money;
  totalPrice: Money;
};

export type Order = {
  id: string;
  secret: string;
  createdAt: string;
  completed: boolean;
  stateName: string;
  total: Money;
  customerName: string;
  customerEmail: string;
  lineCount: number;
  lines: OrderLine[];
};

export type FacetOption = {
  label: string;
  value: string;
  count: number;
  selected: boolean;
};

export type Facet = {
  name: string;
  queryParameter: string;
  options: FacetOption[];
};

export type Address = {
  id: string;
  name: string;
  address: string;
  address2: string;
  zip: string;
  city: string;
  country: string;
  countryCode: string;
  isBilling: boolean;
  isShipping: boolean;
};
