import test from "node:test";
import assert from "node:assert/strict";
import { detectLocale } from "../shared/locale.mjs";

test("system language negotiation honors manual choice and regional preferences", () => {
  assert.equal(detectLocale("en", ["de-CH"]), "en");
  assert.equal(detectLocale(null, ["fr-CH", "de-CH", "en-US"]), "de");
  assert.equal(detectLocale(null, ["en-GB", "de-DE"]), "en");
  assert.equal(detectLocale("invalid", ["DE_ch"]), "de");
  assert.equal(detectLocale(null, ["ja-JP"]), "en");
  assert.equal(detectLocale(null, []), "en");
});
