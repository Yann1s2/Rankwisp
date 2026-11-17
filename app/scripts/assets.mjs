import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
const mark = readFileSync("public/mark.svg", "utf8");
await sharp(Buffer.from(mark.replace('rx="22"', 'rx="0"')))
  .resize(1024, 1024)
  .png()
  .toFile("public/icon.png");
const social = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#f5f7ee"/><g transform="translate(70 65)">${mark.replace("<svg ", '<svg width="64" height="64" ')}</g><text x="153" y="110" font-family="Helvetica,Arial" font-size="38" font-weight="600" fill="#294333">rankwisp.</text><text x="70" y="285" font-family="Helvetica,Arial" font-size="70" fill="#294333">A clearer view.</text><text x="70" y="370" font-family="Georgia" font-style="italic" font-size="72" fill="#71875b">A better next move.</text><text x="73" y="490" font-family="Helvetica,Arial" font-size="24" fill="#657452">App Store research, with perspective.</text><path d="M850 410C900 410 910 330 960 330S1030 210 1125 200" stroke="#7c9661" stroke-width="7" fill="none" stroke-linecap="round"/><circle cx="1125" cy="200" r="11" fill="#294333"/></svg>`;
await sharp(Buffer.from(social)).png().toFile("public/social.png");
const splash = `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732"><rect width="2732" height="2732" fill="#f6f7f3"/><g transform="translate(1238 1180)">${mark.replace("<svg ", '<svg width="256" height="256" ')}</g><text x="1366" y="1530" text-anchor="middle" font-family="Helvetica,Arial" font-weight="600" font-size="70" fill="#294333">rankwisp.</text></svg>`;
const png = await sharp(Buffer.from(splash)).png().toBuffer();
for (const n of [
  "splash-2732x2732.png",
  "splash-2732x2732-1.png",
  "splash-2732x2732-2.png",
])
  writeFileSync("ios/App/App/Assets.xcassets/Splash.imageset/" + n, png);
await sharp("public/icon.png").toFile(
  "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon.png",
);
