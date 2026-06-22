/**
 * Copy web-poc runtime assets that tsc doesn't emit (plain .js / static files)
 * from src into dist, so the compiled bin (dist/src/server/web-poc/server.js)
 * can load them relative to __dirname. Wired into `npm run build`.
 */
import * as fs from "fs";
import * as path from "path";

const srcDir = path.resolve(__dirname, "../src/server/web-poc");
const outDir = path.resolve(__dirname, "../dist/src/server/web-poc");

// Assets the server reads at runtime via __dirname (not picked up by tsc).
// certs/ is intentionally omitted — it's generated on first run by ensureCert().
const ASSETS = ["preload-shim.js"];

fs.mkdirSync(outDir, { recursive: true });
for (const name of ASSETS) {
    fs.copyFileSync(path.join(srcDir, name), path.join(outDir, name));
    console.log(`[copy-web-poc-assets] ${name} -> dist`);
}
