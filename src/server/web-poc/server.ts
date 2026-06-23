#!/usr/bin/env node
/**
 * web-poc/server.ts — Serve the 本家 Antigravity UI as a web app.
 *
 * Architecture:
 *
 *   Browser ──HTTP/2 (TLS)──> this proxy ──HTTP/1.1 (TLS, many sockets)──> language_server
 *
 * WHY HTTP/2 ON THE BROWSER SIDE:
 *   The UI opens many long-lived server-streams at once (AgentState,
 *   ProjectUpdates, AppState, Sidecars, TrajectorySummaries, and one
 *   WatchDirectory PER OPEN FILE). Over HTTP/1.1 a browser allows only ~6
 *   connections per origin, so the extra infinite streams (notably the file
 *   WatchDirectory) get starved → file view spins forever. HTTP/2 multiplexes
 *   them all over a single connection, which is what the real app does
 *   (the LS is spoken to over h2). Browsers only do h2 over TLS, hence the
 *   self-signed cert below.
 *
 * The proxy also:
 *   - Injects the CSRF token header on every upstream request (browser never
 *     needs it) and rewrites Host/Origin/Referer to look same-origin to the LS.
 *   - Injects <script src="/__ag_shim.js"> as the first <head> child so the web
 *     port of preload.js (window.electron* globals) runs before the app bundle.
 *   - Strips CSP/HSTS on HTML and hop-by-hop headers (illegal in h2) on every
 *     response.
 *
 * Run:  npx tsx src/server/web-poc/server.ts [workspacePath] [geminiDir] [appDataDir]
 *       PORT=8765 VERBOSE=1 npx tsx src/server/web-poc/server.ts
 *       GEMINI_DIR=~/.gemini APP_DATA_DIR=antigravity npx tsx src/server/web-poc/server.ts
 *
 * geminiDir defaults to the real ~/.gemini profile and appDataDir to "antigravity"
 * (the IDE's namespace), so the UI shows your existing Projects AND conversations.
 * Override either (argv[3]/GEMINI_DIR, argv[4]/APP_DATA_DIR) for an isolated profile.
 * Close the Antigravity IDE first — two LS writing the same state can corrupt it.
 *
 * The cert is self-signed, so the browser shows a one-time warning — click
 * "Advanced → proceed to localhost". https://localhost is a secure context.
 */
import * as http from "http";
import * as http2 from "http2";
import * as https from "https";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execFileSync } from "child_process";
import { Launcher } from "../launcher.js";

const PORT = Number(process.env.PORT) || 8765;
const WORKSPACE = process.argv[2] || process.cwd();
// State dir the LS reads existing Projects/history from (loaded from
// <geminiDir>/config/projects). Defaults to the real Antigravity profile so the
// web UI shows your existing Projects; override with argv[3] or GEMINI_DIR to
// point at an isolated/alternate profile. Don't share ~/.gemini with a running
// Antigravity IDE (two LS writing the same state can corrupt it).
const GEMINI_DIR = process.argv[3] || process.env.GEMINI_DIR || path.join(os.homedir(), ".gemini");
// App-data namespace under GEMINI_DIR (LS --app_data_dir). Conversations/history
// live in <GEMINI_DIR>/<appDataDir>/. Defaults to "antigravity" — the real IDE's
// namespace — so the web UI shows your existing conversations too; override with
// argv[4] or APP_DATA_DIR (e.g. "antigravity_client") for an isolated namespace.
const APP_DATA_DIR = process.argv[4] || process.env.APP_DATA_DIR || "antigravity";
const SHIM_PATH = "/__ag_shim.js";
const SHIM_FILE = path.join(__dirname, "preload-shim.js");
const SHIM_TAG = `<script src="${SHIM_PATH}"></script>`;
// Generated TLS certs live OUTSIDE the package tree (a private key must never be
// shipped in the npm tarball), in a stable per-user dir so the browser only warns
// once. ensureCert() creates them here on first run.
const CERT_DIR = path.join(os.homedir(), ".gemini", "web-poc-certs");

// Hop-by-hop headers — illegal in HTTP/2 responses, must be stripped.
const HOP_BY_HOP = [
  "connection", "keep-alive", "transfer-encoding", "upgrade",
  "proxy-connection", "te", "trailer",
];

function injectShim(html: string): string {
  const headRe = /<head[^>]*>/i;
  if (headRe.test(html)) return html.replace(headRe, (m) => m + SHIM_TAG);
  const htmlRe = /<html[^>]*>/i;
  if (htmlRe.test(html)) return html.replace(htmlRe, (m) => m + SHIM_TAG);
  return SHIM_TAG + html;
}

/** Find the openssl binary — checks common bundled locations on Windows first. */
function findOpenssl(): string {
  if (process.platform === "win32") {
    const candidates = [
      path.join(process.env.ProgramFiles || "C:\\Program Files", "Git", "usr", "bin", "openssl.exe"),
      path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Git", "usr", "bin", "openssl.exe"),
      path.join(process.env.ProgramFiles || "C:\\Program Files", "OpenSSL-Win64", "bin", "openssl.exe"),
      path.join(process.env.ProgramFiles || "C:\\Program Files", "OpenSSL", "bin", "openssl.exe"),
    ];
    const found = candidates.find(p => fs.existsSync(p));
    if (found) return found;
  }
  return "openssl"; // fall back to PATH
}

/**
 * Load TLS credentials.
 * Priority: TLS_CERT/TLS_KEY env vars → existing self-signed → generate new self-signed.
 *
 * For Tailscale HTTPS (recommended for remote access):
 *   tailscale cert --cert-file ~/.gemini/web-poc-certs/tailscale.crt \
 *                  --key-file  ~/.gemini/web-poc-certs/tailscale.key \
 *                  <hostname>.ts.net
 *   TLS_CERT=~/.gemini/web-poc-certs/tailscale.crt TLS_KEY=~/.gemini/web-poc-certs/tailscale.key npm run web
 */
function ensureCert(): { key: Buffer; cert: Buffer } {
  // 1. External certificate via environment variables
  const extCert = process.env.TLS_CERT;
  const extKey = process.env.TLS_KEY;
  if (extCert && extKey) {
    if (!fs.existsSync(extCert)) throw new Error(`[poc] TLS_CERT file not found: ${extCert}`);
    if (!fs.existsSync(extKey)) throw new Error(`[poc] TLS_KEY file not found: ${extKey}`);
    console.log(`[poc] using external TLS cert: ${extCert}`);
    return { key: fs.readFileSync(extKey), cert: fs.readFileSync(extCert) };
  }

  // 2. Self-signed certificate (generate on first run)
  const keyPath = path.join(CERT_DIR, "key.pem");
  const certPath = path.join(CERT_DIR, "cert.pem");
  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    fs.mkdirSync(CERT_DIR, { recursive: true });
    const opensslBin = findOpenssl();
    console.log(`[poc] generating self-signed localhost cert… (${opensslBin})`);
    // On some Windows openssl builds, -subj needs //CN= instead of /CN=
    const subj = process.platform === "win32" ? "//CN=localhost" : "/CN=localhost";
    try {
      execFileSync(opensslBin, [
        "req", "-x509", "-newkey", "rsa:2048", "-nodes",
        "-keyout", keyPath, "-out", certPath, "-days", "3650",
        "-subj", subj,
        "-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1",
      ], { stdio: "ignore" });
    } catch (e) {
      throw new Error(
        `[poc] Failed to generate TLS certificate. openssl is required.\n` +
        (process.platform === "win32"
          ? `On Windows, install OpenSSL via one of:\n` +
            `  - Git for Windows (includes openssl): https://git-scm.com/\n` +
            `  - choco install openssl\n` +
            `  - winget install ShiningLight.OpenSSL\n`
          : `Please install openssl and try again.\n`) +
        `Or manually place key.pem and cert.pem in: ${CERT_DIR}`
      );
    }
  }
  return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
}

async function main() {
  console.log(`[poc] Launching language_server (workspace: ${WORKSPACE}, geminiDir: ${GEMINI_DIR}, appDataDir: ${APP_DATA_DIR})...`);
  const launcher = await Launcher.start({ workspacePath: WORKSPACE, geminiDir: GEMINI_DIR, appDataDir: APP_DATA_DIR, verbose: !!process.env.VERBOSE });

  const upstreamHost = "127.0.0.1";
  const upstreamPort = launcher.httpsPort;
  const csrf = launcher.csrfToken;
  const upstreamOrigin = `https://${upstreamHost}:${upstreamPort}`;
  console.log(`[poc] LS ready: HTTPS ${upstreamPort}, csrf ${csrf.slice(0, 8)}…`);

  const shimSource = fs.readFileSync(SHIM_FILE);
  const { key, cert } = ensureCert();

  // Many concurrent infinite streams fan out to many upstream sockets.
  const agent = new https.Agent({ rejectUnauthorized: false, maxSockets: Infinity, keepAlive: true });

  const handler = (req: http2.Http2ServerRequest, res: http2.Http2ServerResponse) => {
    // Serve the shim itself.
    if (req.url === SHIM_PATH) {
      res.writeHead(200, {
        "content-type": "application/javascript; charset=utf-8",
        "cache-control": "no-store",
      });
      res.end(shimSource);
      return;
    }

    // Upstream headers: spoof same-origin + inject CSRF, force identity.
    // Drop HTTP/2 pseudo-headers (":path" etc.) — invalid for an h1 upstream.
    const headers: http.OutgoingHttpHeaders = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (!k.startsWith(":")) headers[k] = v as string | string[];
    }
    headers["host"] = `${upstreamHost}:${upstreamPort}`;
    headers["x-codeium-csrf-token"] = csrf;
    if (headers["origin"]) headers["origin"] = upstreamOrigin;
    if (headers["referer"]) {
      headers["referer"] = String(headers["referer"]).replace(/^https?:\/\/[^/]+/i, upstreamOrigin);
    }
    delete headers["accept-encoding"]; // identity so we can rewrite HTML

    const upReq = https.request(
      { host: upstreamHost, port: upstreamPort, method: req.method, path: req.url, headers, agent },
      (upRes) => {
        const ct = String(upRes.headers["content-type"] || "");
        const isHtml = ct.includes("text/html");

        const outHeaders: http.OutgoingHttpHeaders = {};
        for (const [k, v] of Object.entries(upRes.headers)) {
          const lk = k.toLowerCase();
          if (HOP_BY_HOP.includes(lk)) continue;          // illegal in h2
          if (lk === "content-security-policy") continue; // would block our shim
          if (lk === "content-security-policy-report-only") continue;
          if (lk === "strict-transport-security") continue;
          outHeaders[k] = v as string | string[];
        }

        if (!isHtml) {
          res.writeHead(upRes.statusCode || 502, outHeaders);
          upRes.pipe(res);
          return;
        }

        // Buffer HTML, inject the shim, fix content-length.
        const chunks: Buffer[] = [];
        upRes.on("data", (c) => chunks.push(c));
        upRes.on("end", () => {
          const buf = Buffer.from(injectShim(Buffer.concat(chunks).toString("utf-8")), "utf-8");
          delete outHeaders["content-encoding"];
          outHeaders["content-length"] = String(buf.length);
          res.writeHead(upRes.statusCode || 200, outHeaders);
          res.end(buf);
        });
      }
    );

    upReq.on("error", (err) => {
      console.error(`[poc] upstream error for ${req.url}:`, err.message);
      if (!res.headersSent) res.writeHead(502);
      res.end("Upstream error: " + err.message);
    });

    req.pipe(upReq);
  };

  const server = http2.createSecureServer({ key, cert, allowHTTP1: true }, handler);
  server.on("sessionError", (err) => console.error("[poc] h2 session error:", err.message));

  server.listen(PORT, () => {
    console.log("\n" + "=".repeat(60));
    console.log(`  本家UI (web):  https://localhost:${PORT}/   (HTTP/2)`);
    console.log(`  Upstream LS:    ${upstreamOrigin}`);
    console.log("=".repeat(60) + "\n");
    console.log("Open the https:// URL above. Accept the self-signed cert warning once.");
  });

  const shutdown = async () => {
    console.log("\n[poc] shutting down…");
    server.close();
    await launcher.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[poc] fatal:", err);
  process.exit(1);
});
