
import { AutoDetector } from "../src/autodetect.js";

async function main() {
  const detector = new AutoDetector();
  try {
    console.log("🔍 Scanning for Antigravity Language Servers...");
    const server = await detector.findBestServer();

    console.log("✅ Found Server:");
    console.log(`   PID: ${server.pid}`);
    console.log(`   HTTP Port: ${server.httpPort}`);
    console.log(`   HTTPS Port: ${server.httpsPort} (Connect RPC)`);
    console.log(`   CSRF Token: ${server.csrfToken}`);
    console.log(`   Workspace: ${server.workspaceId}`);
    console.log(`   Started: ${server.startTime.toISOString()}`);

    if (!server.httpsPort) {
        console.error("❌ Failed to detect HTTPS port. RPC will not work.");
        process.exit(1);
    }
  } catch (e) {
    console.error("❌ Error:", e);
  }
}

main();
