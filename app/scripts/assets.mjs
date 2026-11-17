import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
const source = "../docs/brand/symbol-source.png";
const iconSource = "../docs/brand/app-icon-source.png";
// Preserve Imagegen originals; these are deterministic production-size exports.
await sharp(source)
  .resize(512, 512, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png({ compressionLevel: 9 })
  .toFile("public/brand/symbol.png");
await sharp(iconSource)
  .resize(1024, 1024)
  .flatten({ background: "#111D4A" })
  .removeAlpha()
  .png({ compressionLevel: 9 })
  .toFile("public/icon.png");
await sharp("public/icon.png")
  .resize(64, 64)
  .png()
  .toFile("public/favicon.png");
const symbol = await sharp("public/brand/symbol.png")
  .resize(280, 280)
  .toBuffer();
const social = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#FFF8F0"/><text x="72" y="110" font-family="Helvetica,Arial" font-size="36" font-weight="600" letter-spacing="-1" fill="#111D4A">rankwisp</text><text x="72" y="295" font-family="Helvetica,Arial" font-size="66" font-weight="600" letter-spacing="-2" fill="#111D4A">A clearer view.</text><text x="72" y="378" font-family="Helvetica,Arial" font-size="66" font-weight="600" letter-spacing="-2" fill="#111D4A">A better next move.</text><rect x="75" y="440" width="45" height="4" rx="2" fill="#92140C"/><text x="72" y="516" font-family="Helvetica,Arial" font-size="22" fill="#1E1E24">App Store visibility, with perspective.</text></svg>`;
await sharp(Buffer.from(social))
  .composite([{ input: symbol, left: 875, top: 175 }])
  .png()
  .toFile("public/social.png");
if (process.argv.includes("--native")) {
  const splashSymbol = await sharp("public/brand/symbol.png")
    .resize(420, 420)
    .toBuffer();
  const splash = await sharp({
    create: { width: 2732, height: 2732, channels: 3, background: "#FFF8F0" },
  })
    .composite([{ input: splashSymbol, left: 1156, top: 1156 }])
    .png()
    .toBuffer();
  for (const name of [
    "splash-2732x2732.png",
    "splash-2732x2732-1.png",
    "splash-2732x2732-2.png",
  ])
    writeFileSync(
      "ios/App/App/Assets.xcassets/Splash.imageset/" + name,
      splash,
    );
  writeFileSync(
    "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon.png",
    readFileSync("public/icon.png"),
  );
}
