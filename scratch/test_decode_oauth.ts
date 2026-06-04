import { readUssOAuthData } from "../src/server/auth-reader.js";
import { OAuthTokenInfo } from "../src/gen/exa/language_server_pb/language_server_pb.js";

async function main() {
    try {
        console.log("🔓 Reading Unified State Sync OAuth Token from SQLite...");
        const uss = readUssOAuthData();
        
        if (!uss.value) {
            console.error("❌ No OAuth token data found in SQLite!");
            return;
        }

        console.log("📦 Base64 value found. Length:", uss.value.length);
        
        // Base64 からバイナリにデコードして OAuthTokenInfo を復元
        const bytes = Buffer.from(uss.value, "base64");
        const tokenInfo = OAuthTokenInfo.fromBinary(bytes);

        console.log("\n🔑 Decoded OAuthTokenInfo:");
        console.log(`  - Access Token : ${tokenInfo.accessToken ? (tokenInfo.accessToken.substring(0, 20) + "...") : "empty"}`);
        console.log(`  - Refresh Token: ${tokenInfo.refreshToken ? (tokenInfo.refreshToken.substring(0, 20) + "...") : "empty"}`);
        console.log(`  - Expiry       :`, tokenInfo.expiry);
        console.log(`  - Is GCP ToS   :`, tokenInfo.isGcpTos);

    } catch (e) {
        console.error("❌ Failed to decode OAuth token info:", e);
    }
}

main();
