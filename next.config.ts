// Derive the DW media host (product images serve from `<host>/Files/...`) from
// DW_API_BASE so next/image accepts them on any demo backend, not a pinned port.
const dwApiBase = process.env.DW_API_BASE || "https://localhost:58039";
const dwUrl = new URL(dwApiBase);

export default {
  experimental: {
    ppr: true,
    inlineCss: true,
    useCache: true,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      // DynamicWeb media host — product images/files serve from `/Files/...`.
      {
        protocol: dwUrl.protocol.replace(":", "") as "http" | "https",
        hostname: dwUrl.hostname,
        port: dwUrl.port,
        pathname: "/Files/**",
      },
    ],
  },
};
