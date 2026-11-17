import React from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import App from "./App";
import { Marketing } from "./marketing";
import { LocaleProvider } from "./i18n";
import "./style.css";
import "./identity.css";
const path = location.pathname;
const isApp =
  path.startsWith("/app") ||
  (path === "/" &&
    (location.protocol === "rankwisp:" ||
      !!window.rankwisp ||
      location.protocol === "capacitor:"));
const locale =
  path.split("/")[1] === "de"
    ? "de"
    : localStorage.getItem("rankwisp-language") || "en";
document.documentElement.lang = locale;
const tree = isApp ? (
  <LocaleProvider initial={locale}>
    <App />
  </LocaleProvider>
) : (
  <Marketing
    locale={path.startsWith("/de") ? "de" : "en"}
    page={path.split("/")[2] || "home"}
  />
);
const root = document.getElementById("root");
if (root.hasChildNodes() && !isApp) hydrateRoot(root, tree);
else createRoot(root).render(tree);
