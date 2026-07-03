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
        protocol: "https",
        hostname: "localhost",
        port: "57301",
        pathname: "/Files/**",
      },
    ],
  },
};
