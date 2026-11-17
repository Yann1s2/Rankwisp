import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
const mark = readFileSync("public/mark.svg", "utf8");
const mascot = readFileSync("public/wisp.svg", "utf8");
await sharp(Buffer.from(mark.replace('rx="30"', 'rx="0"')))
  .resize(1024, 1024)
  .png()
  .toFile("public/icon.png");
const social = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#FFF8F0"/><g transform="translate(65 55)">${mark.replace('width="128" height="128"', 'width="64" height="64"')}</g><text x="147" y="101" font-family="Helvetica,Arial" font-size="36" font-weight="700" fill="#111D4A">rankwisp.</text><text x="65" y="278" font-family="Helvetica,Arial" font-size="63" font-weight="700" fill="#111D4A">Your app has potential.</text><text x="65" y="361" font-family="Georgia" font-style="italic" font-size="68" fill="#92140C">Make it visible.</text><text x="68" y="470" font-family="Helvetica,Arial" font-size="23" fill="#1E1E24">App Store research. A little perspective.</text><g transform="translate(850 280) scale(.82)">${mascot}</g></svg>`;
await sharp(Buffer.from(social)).png().toFile("public/social.png");
if (process.argv.includes("--native")) {
  const splash = `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732"><rect width="2732" height="2732" fill="#FFF8F0"/><g transform="translate(1238 1180)">${mark.replace('width="128" height="128"', 'width="256" height="256"')}</g><text x="1366" y="1530" text-anchor="middle" font-family="Helvetica,Arial" font-weight="700" font-size="70" fill="#111D4A">rankwisp.</text></svg>`;
  const png = await sharp(Buffer.from(splash)).png().toBuffer();
  for (const name of [
    "splash-2732x2732.png",
    "splash-2732x2732-1.png",
    "splash-2732x2732-2.png",
  ])
    writeFileSync("ios/App/App/Assets.xcassets/Splash.imageset/" + name, png);
  await sharp("public/icon.png").toFile(
    "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon.png",
  );
}
