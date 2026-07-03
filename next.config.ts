// Derive the DW media host (product images serve from `<host>/Files/...`) from
// DW_API_BASE so next/image accepts them on any demo backend, not a pinned port.
const dwApiBase = process.env.DW_API_BASE || "https://localhost:58039";
const dwUrl = new URL(dwApiBase);

// Next 15.6+ hardened the image optimizer with an SSRF guard: it resolves the
// upstream image host and rejects any that maps to a loopback/private IP with
// a 400 `"url" parameter is not allowed`, UNLESS `images.dangerouslyAllowLocalIP`
// is set — this fires even when the host matches `remotePatterns`. Local/on-prem
// DW backends (localhost, 127.x, ::1, 10.x, 192.168.x, 172.16–31.x, *.local) all
// trip it. Enable the escape hatch only when the DERIVED host is itself local, so
// a public DW backend keeps the SSRF protection.
const dwHost = dwUrl.hostname;
const dwHostIsLocal =
  dwHost === "localhost" ||
  dwHost === "::1" ||
  dwHost.endsWith(".local") ||
  /^127\./.test(dwHost) ||
  /^10\./.test(dwHost) ||
  /^192\.168\./.test(dwHost) ||
  /^172\.(1[6-9]|2\d|3[01])\./.test(dwHost);

export default {
  experimental: {
    ppr: true,
    inlineCss: true,
    useCache: true,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    dangerouslyAllowLocalIP: dwHostIsLocal,
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
