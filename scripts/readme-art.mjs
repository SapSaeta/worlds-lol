// Genera las imágenes de la portada del repositorio (README) a partir de
// .github/readme/art.html, en español y en inglés.
//
//   npm i --no-save playwright && node scripts/readme-art.mjs

import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".github", "readme");
const scenes = ["banner", "directo", "worlddex", "mapa", "jugar"];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 700 }, deviceScaleFactor: 1 });
for (const lang of ["es", "en"]) {
  for (const scene of scenes) {
    await page.goto(`file://${dir}/art.html?scene=${scene}&lang=${lang}`);
    await page.evaluate(() => document.fonts.ready);
    await page.locator(`#${scene}`).screenshot({ path: path.join(dir, `${scene}-${lang}.png`) });
  }
}
await browser.close();
