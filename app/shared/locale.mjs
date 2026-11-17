export const SUPPORTED_LOCALES = ["en", "de"];

export function detectLocale(saved, languages = []) {
  if (SUPPORTED_LOCALES.includes(saved)) return saved;
  for (const language of languages) {
    const base = String(language).toLowerCase().split(/[-_]/)[0];
    if (SUPPORTED_LOCALES.includes(base)) return base;
  }
  return "en";
}

export function preferredLocale() {
  let saved;
  try { saved = localStorage.getItem("rankwisp-language"); } catch {}
  return detectLocale(saved, navigator.languages?.length ? navigator.languages : [navigator.language]);
}
