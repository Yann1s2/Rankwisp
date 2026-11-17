import { createServer } from "vite";
import { renderToString } from "react-dom/server";
import React from "react";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  optimizeDeps: { noDiscovery: true, include: [] },
});
const { Marketing } = await server.ssrLoadModule("/src/marketing.jsx");
const template = readFileSync("dist/index.html", "utf8");
const base = process.env.SITE_URL?.replace(/\/$/, "");
const valid = base && /^https:\/\/[^/]+$/.test(base);
const apiOrigin = process.env.VITE_API_ORIGIN || "";
if (apiOrigin && !/^https:\/\/[^/]+$/.test(apiOrigin) && !/^http:\/\/127\.0\.0\.1:\d+$/.test(apiOrigin)) throw new Error("VITE_API_ORIGIN must be an HTTPS origin (or explicit local development origin)");
writeFileSync("dist/native-config.json", JSON.stringify({ apiOrigin, development: process.env.NATIVE_LOCAL_DEVELOPMENT === "true" && /^http:\/\/127\.0\.0\.1:/.test(apiOrigin) }));
const routes = [];
for (const locale of ["en", "de"])
  for (const page of [
    "home",
    "privacy",
    "terms",
    "legal",
    "support",
    "downloads",
  ]) {
    const path = `/${locale}${page === "home" ? "" : "/" + page}`;
    const title =
      page === "home"
        ? locale === "en"
          ? "Rankwisp — A clearer view. A better next move."
          : "Rankwisp — Ein klarer Blick. Ein guter nächster Schritt."
        : `${{ privacy: locale === "de" ? "Datenschutz" : "Privacy", terms: locale === "de" ? "Bedingungen" : "Terms", legal: locale === "de" ? "Impressum" : "Legal notice", support: "Support", downloads: locale === "de" ? "Plattformen" : "Platforms" }[page]} · Rankwisp`;
    const description = locale === "de" ? "Finde den nächsten Schritt für deine App. App-Store-Keywords verfolgen, Mitbewerber verstehen und datenbasierte KI-Hinweise erhalten. 24 Tage testen." : "Find your app's next move. App Store keyword tracking, clear competitor research and grounded AI guidance. 24 days to explore.";
    const seo = valid
      ? `<link rel="canonical" href="${base}${path}"/>${["en", "de"].map((l) => `<link rel="alternate" hreflang="${l}" href="${base}/${l}${page === "home" ? "" : "/" + page}"/>`).join("")}<link rel="alternate" hreflang="x-default" href="${base}/en${page === "home" ? "" : "/" + page}"/><meta property="og:url" content="${base}${path}"/>`
      : "";
    const html = template
      .replace('<html lang="en">', `<html lang="${locale}">`)
      .replace(/<meta name="description" content="[^"]*"\/>/, `<meta name="description" content="${description}"/>`)
      .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
      .replace(
        "</head>",
        `${seo}<meta property="og:title" content="${title}"/><meta property="og:type" content="website"/><meta property="og:locale" content="${locale === "de" ? "de_CH" : "en_GB"}"/><meta name="twitter:card" content="summary_large_image"/>${valid ? `<meta property="og:image" content="${base}/social.png"/>` : ""}</head>`,
      )
      .replace(
        '<div id="root"></div>',
        `<div id="root">${renderToString(React.createElement(Marketing, { locale, page }))}</div>`,
      );
    mkdirSync("dist" + path, { recursive: true });
    writeFileSync("dist" + path + "/index.html", html);
    if (locale === "en" && page === "home")
      writeFileSync("dist/index.html", html);
    routes.push(path);
  }
writeFileSync(
  "dist/robots.txt",
  "User-agent: *\nDisallow: /\n" +
    (valid ? `Sitemap: ${base}/sitemap.xml\n` : ""),
);
writeFileSync(
  "dist/sitemap.xml",
  '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    (valid
      ? routes.map((path) => `<url><loc>${base}${path}</loc></url>`).join("")
      : "") +
    "</urlset>",
);
await server.close();
console.log(
  "Rendered 12 EN/DE pages. Preview stays noindex. " +
    (valid
      ? "Canonical/hreflang/sitemap generated."
      : "Set SITE_URL before generating production canonical/hreflang/sitemap."),
);
