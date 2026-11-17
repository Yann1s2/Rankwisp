import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Collect upstream notices verbatim for redistributions. Requires npm ci first.
const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
const parts = [
  "Rankwisp third-party license texts\nGenerated from package-lock.json and installed runtime packages.\nUpstream licenses apply to their respective packages, not the project as a whole.",
];
for (const [directory, entry] of Object.entries(lock.packages)) {
  if (!directory || entry.dev) continue;
  let names;
  try {
    names = await readdir(directory);
  } catch {
    if (entry.optional) continue;
    throw Error(`Install dependencies before generating notices: ${directory}`);
  }
  const licenses = names.filter((name) =>
    /^(licen[sc]e|copying|notice)(\.|$)/i.test(name),
  );
  if (!licenses.length) {
    const fallback = {
      "node_modules/jsrsasign": "jsrsasign",
      "node_modules/tr46": "tr46",
    }[directory];
    if (!fallback)
      throw Error(`Review missing upstream license text: ${directory}`);
    parts.push(
      `===== ${fallback} ${entry.version} / upstream license =====\n${await readFile(`../docs/licenses/${fallback}.txt`, "utf8")}`,
    );
  }
  for (const name of licenses.sort()) {
    const text = await readFile(join(directory, name), "utf8");
    parts.push(
      `===== ${directory.replace(/^node_modules\//, "")} ${entry.version} / ${name} =====\n${text}`,
    );
  }
}
await writeFile("../THIRD_PARTY_LICENSES.txt", parts.join("\n\n") + "\n");
console.log(
  "Generated THIRD_PARTY_LICENSES.txt from installed runtime dependencies.",
);
