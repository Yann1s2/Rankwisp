import React, { createContext, useContext, useState } from "react";
const Context = createContext(null);
export function LocaleProvider({ children, initial }) {
  const [locale, set] = useState(initial || "en");
  const change = (value) => {
    set(value);
    document.documentElement.lang = value;
    localStorage.setItem("rankwisp-language", value);
  };
  const tr = (en, de) => (locale === "de" ? de : en);
  const date = (v, options = { day: "numeric", month: "short" }) =>
    new Intl.DateTimeFormat(
      locale === "de" ? "de-CH" : "en-GB",
      options,
    ).format(new Date(v));
  const number = (v, options = {}) =>
    new Intl.NumberFormat(locale === "de" ? "de-CH" : "en-GB", options).format(
      v,
    );
  return (
    <Context.Provider value={{ locale, setLocale: change, tr, date, number }}>
      {children}
    </Context.Provider>
  );
}
export const useLocale = () => useContext(Context);
export function errorText(code, locale) {
  const errors = {
    SIGN_IN_REQUIRED: ["Please sign in to continue.", "Bitte melde dich an."],
    INVALID_LOGIN: [
      "Email or password is incorrect.",
      "E-Mail oder Passwort ist falsch.",
    ],
    INVITE_REQUIRED: [
      "A valid preview invitation is required.",
      "Eine gültige Vorschau-Einladung ist nötig.",
    ],
    ACCOUNT_UNAVAILABLE: [
      "This account cannot be created. Try signing in.",
      "Dieses Konto kann nicht erstellt werden. Versuche die Anmeldung.",
    ],
    INVALID_INPUT: [
      "Please check your entries. Passwords need at least 12 characters.",
      "Bitte prüfe deine Eingaben. Passwörter benötigen mindestens 12 Zeichen.",
    ],
    RATE_LIMIT: [
      "A few too many requests. Please wait a moment.",
      "Zu viele Anfragen. Bitte warte einen Moment.",
    ],
    APPLE_RATE_LIMIT: [
      "Apple is limiting requests. Your history is safe. Try again later.",
      "Apple begrenzt gerade die Anfragen. Dein Verlauf bleibt erhalten. Versuche es später.",
    ],
    APPLE_UNAVAILABLE: [
      "Apple could not be reached. Your last valid observations are preserved.",
      "Apple ist gerade nicht erreichbar. Die letzten gültigen Messungen bleiben erhalten.",
    ],
    APPLE_INVALID_RESPONSE: [
      "Apple returned an incomplete response. No rank was recorded.",
      "Apple lieferte eine unvollständige Antwort. Es wurde kein Rang gespeichert.",
    ],
    TRIAL_ENDED: [
      "Your trial has ended. You can still read and export all your data.",
      "Deine Testphase ist beendet. Du kannst weiterhin alle Daten lesen und exportieren.",
    ],
    PAYMENTS_NOT_CONFIGURED: [
      "Purchases are not available in this local preview.",
      "Käufe sind in dieser lokalen Vorschau noch nicht verfügbar.",
    ],
    REFRESH_RUNNING: [
      "This project is already refreshing.",
      "Dieses Projekt wird bereits aktualisiert.",
    ],
    IMPORT_CONFLICT: [
      "Your workspace changed. Preview the import again.",
      "Dein Arbeitsbereich wurde geändert. Prüfe den Import erneut.",
    ],
    PROJECT_EXISTS: [
      "This app and storefront are already in your workspace.",
      "Diese App und dieser Store sind bereits vorhanden.",
    ],
    KEYWORD_LIMIT: [
      "Up to 50 active keywords per app, 100 characters each.",
      "Bis zu 50 aktive Keywords je App, jeweils maximal 100 Zeichen.",
    ],
    APP_NOT_FOUND: [
      "No app was found in this storefront. Try another country.",
      "In diesem Store wurde keine App gefunden. Versuche ein anderes Land.",
    ],
    INVALID_APP_URL: [
      "Use an apps.apple.com link, app ID or app name.",
      "Nutze einen apps.apple.com-Link, eine App-ID oder einen App-Namen.",
    ],
    NETWORK: [
      "The server is unavailable. Check your connection and try again.",
      "Der Server ist nicht erreichbar. Prüfe deine Verbindung und versuche es erneut.",
    ],
  };
  return (errors[code] || [
    "Something went wrong. Your saved data is unchanged. Please try again.",
    "Etwas ist fehlgeschlagen. Deine gespeicherten Daten bleiben erhalten. Bitte versuche es erneut.",
  ])[locale === "de" ? 1 : 0];
}
