import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Globe, Search } from "lucide-react";
import { Brand, Button } from "./components";
import { useLocale } from "./i18n";
import "./welcome.css";

export default function Welcome({ onComplete }) {
  const { tr, locale, setLocale } = useLocale();
  const [step, setStep] = useState(0);
  const heading = useRef(null);
  const titles = [tr("Good apps deserve to be found.", "Gute Apps verdienen Sichtbarkeit."), tr("Start with your own app.", "Beginne mit deiner eigenen App."), tr("Watch what really changes.", "Sieh, was sich wirklich verändert.")];
  const descriptions = [tr("A little perspective on your App Store presence. Your app, your keywords, your next move.", "Ein klarer Blick auf deine Präsenz im App Store. Deine App, deine Keywords, dein nächster Schritt."), tr("Choose a storefront, find your app and select useful comparisons. Every suggestion stays your decision.", "Wähle einen Store, finde deine App und passende Vergleiche. Über jeden Vorschlag entscheidest du selbst."), tr("Your first search creates the starting point. Later measurements reveal changes. No invented history.", "Die erste Abfrage ist dein Ausgangspunkt. Weitere Messungen zeigen Veränderungen. Ohne erfundenen Verlauf.")];
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [step]);
  return <main className="welcome-page">
    <header className="welcome-header"><Brand /><button className="locale-button" onClick={() => setLocale(locale === "en" ? "de" : "en")} aria-label={tr("Change language", "Sprache wechseln")}><Globe size={16} />{locale.toUpperCase()}</button></header>
    <div className="welcome-layout">
      <div className={"welcome-art scene-" + step} aria-hidden="true">
        <div className="welcome-orbit orbit-one" /><div className="welcome-orbit orbit-two" />
        <div className="welcome-mark"><img src="/brand/symbol.png" alt="" width="112" height="112" /></div>
        <div className="welcome-search"><Search size={18} /><span>{tr("Your app", "Deine App")}</span><Check size={16} /></div>
        <div className="welcome-keyword">{tr("Your next keyword", "Dein nächstes Keyword")}<span>↗</span></div>
        <svg className="welcome-trail" viewBox="0 0 400 220"><path d="M28 180 C90 180 90 125 150 125 S220 145 260 85 S320 85 372 35" pathLength="1" /><circle cx="372" cy="35" r="6" /></svg>
        <span className="welcome-art-caption">{tr("A clearer view. One step at a time.", "Ein klarer Blick. Schritt für Schritt.")}</span>
      </div>
      <section className="welcome-copy">
        <div className="welcome-steps" aria-label={tr("Introduction progress", "Fortschritt der Einführung")}>{titles.map((title, i) => <button key={i} aria-label={tr(`Step ${i + 1}`, `Schritt ${i + 1}`)} aria-current={step === i ? "step" : undefined} onClick={() => setStep(i)}><span /></button>)}</div>
        <div className="welcome-panel" key={step}><span className="eyebrow">{tr("WELCOME TO RANKWISP", "WILLKOMMEN BEI RANKWISP")} · 0{step + 1}</span><h1 ref={heading} tabIndex={-1}>{titles[step]}</h1><p>{descriptions[step]}</p></div>
        <div className="welcome-actions">{step > 0 && <button className="icon-button" onClick={() => setStep(step - 1)} aria-label={tr("Back", "Zurück")}><ArrowLeft size={19} /></button>}<Button onClick={() => step < 2 ? setStep(step + 1) : onComplete()}>{step < 2 ? tr("Continue", "Weiter") : tr("Get started", "Loslegen")}<ArrowRight size={18} /></Button></div>
        <button className="text-button welcome-skip" onClick={onComplete}>{tr("Skip introduction", "Einführung überspringen")}</button>
      </section>
    </div>
    <footer className="welcome-footer">{tr("Your data stays yours. Export your history whenever you need it.", "Deine Daten bleiben deine. Exportiere deinen Verlauf jederzeit.")}</footer>
  </main>;
}
