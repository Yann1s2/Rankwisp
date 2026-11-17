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
    API_NOT_CONFIGURED: [
      "This app build has no service connection configured. Please install the current release.",
      "Für diesen App-Build fehlt die Dienstverbindung. Installiere bitte die aktuelle Version.",
    ],
    SERVICE_UNAVAILABLE: [
      "The service is temporarily unavailable. Please try again.",
      "Der Dienst ist vorübergehend nicht verfügbar. Versuche es erneut.",
    ],
    REQUEST_TIMEOUT: [
      "The request took too long. Please try again.",
      "Die Anfrage hat zu lange gedauert. Versuche es erneut.",
    ],
    REQUEST_CANCELLED: [
      "Sign-in cancelled. You can try again any time.",
      "Anmeldung abgebrochen. Du kannst es jederzeit erneut versuchen.",
    ],
    SECURE_STORAGE_UNAVAILABLE: [
      "Your device could not save this session securely. Please unlock your device and try again.",
      "Dein Gerät konnte die Sitzung nicht sicher speichern. Entsperre es und versuche es erneut.",
    ],
    REFRESH_FAILED: [
      "The measurement could not finish. Your previous history is preserved.",
      "Die Messung konnte nicht abgeschlossen werden. Dein bisheriger Verlauf bleibt erhalten.",
    ],
    REFRESH_CONTINUES: [
      "Measurements are still running on the server. Check the workspace again shortly.",
      "Die Messungen laufen auf dem Server weiter. Prüfe den Arbeitsbereich in Kürze erneut.",
    ],
    IMPORT_FILE_TOO_LARGE: [
      "This file is larger than the 48 MB upload limit. Use a Rankblick JSON export within that limit.",
      "Diese Datei überschreitet das Uploadlimit von 48 MB. Nutze einen Rankblick-JSON-Export innerhalb dieses Limits.",
    ],
    IMPORT_INVALID_JSON: [
      "This file is not valid JSON. Choose an original Rankblick export.",
      "Diese Datei ist kein gültiges JSON. Wähle einen originalen Rankblick-Export.",
    ],
    WORKSPACE_STORAGE_LIMIT: [
      "Your workspace has reached its 16 MB storage limit. Export a copy of your history and contact support for help. Your saved data is preserved.",
      "Dein Arbeitsbereich hat sein Speicherlimit von 16 MB erreicht. Exportiere eine Kopie deines Verlaufs und kontaktiere den Support. Deine gespeicherten Daten bleiben erhalten.",
    ],
    ACCOUNT_LINK_REQUIRED: [
      "An existing account already uses this email. Contact support to link it securely.",
      "Ein bestehendes Konto verwendet diese E-Mail. Kontaktiere den Support, um es sicher zu verknüpfen.",
    ],
    GOOGLE_NOT_CONFIGURED: [
      "Google sign-in is not available yet. Please try again later or contact support.",
      "Google-Anmeldung ist noch nicht verfügbar. Versuche es später oder kontaktiere den Support.",
    ],
    GOOGLE_ALREADY_PENDING: [
      "A Google sign-in is already open. Complete or cancel it first.",
      "Eine Google-Anmeldung ist bereits offen. Schliesse sie ab oder brich sie zuerst ab.",
    ],
    GOOGLE_AUTH_FAILED: [
      "Google sign-in could not be completed. Please try again.",
      "Die Google-Anmeldung konnte nicht abgeschlossen werden. Versuche es erneut.",
    ],
    GOOGLE_CANCELLED: [
      "Google sign-in was cancelled. Your account is unchanged.",
      "Google-Anmeldung abgebrochen. Dein Konto ist unverändert.",
    ],
    GOOGLE_EXPIRED: [
      "This sign-in has expired. Please start again.",
      "Diese Anmeldung ist abgelaufen. Bitte beginne erneut.",
    ],
    REAUTH_REQUIRED: [
      "Please sign in again before deleting your account.",
      "Melde dich vor dem Löschen deines Kontos erneut an.",
    ],
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
      "Purchases are not available in this preview.",
      "Käufe sind in dieser Vorschau noch nicht verfügbar.",
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
