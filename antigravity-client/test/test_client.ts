
import { AntigravityClient } from "../src/client.js";

async function main() {
  try {
    console.log("🔌 Connecting to Antigravity Language Server...");
    const client = await AntigravityClient.connect(); // Auto-detect mode

    console.log("✅ Connected!");

    console.log("📡 Calling GetUserStatus...");
    // Direct call via exposed lsClient for now
    const status = await client.getUserStatus();

    console.log("✅ User Status:", status);

  } catch (e) {
    console.error("❌ Client Error:", e);
  }
}

main();
