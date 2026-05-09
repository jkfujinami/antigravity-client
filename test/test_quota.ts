import { AntigravityClient } from "../src/client.js";
import { T } from "../src/facade/index.js";

async function main() {
    try {
        console.log("🔌 Connecting to Antigravity Language Server...");
        const client = await AntigravityClient.connect();

        console.log("📡 Fetching user status via Facade API...\n");

        // 1. 新しい Facade API を使用 (型安全な入力、戻り値も自動推論される)
        const response = await client.languageServer.getUserStatus({});
        console.log(response);

        // 2. すべて LanguageServer 名前空間内で完結
        const us = response.userStatus;

        if (!us) {
            console.log("⚠️  No userStatus in response.");
            return;
        }

        // ── Plan Info ──
        const planStatus = us.planStatus;
        const planInfo = planStatus?.planInfo;

        console.log("═".repeat(50));
        console.log("  📋 Plan Information");
        console.log("═".repeat(50));

        if (planInfo) {
            console.log(`  Plan Name           : ${planInfo.planName || "(unknown)"}`);
            console.log(`  Teams Tier          : ${planInfo.teamsTier ?? "-"}`);
            console.log(`  Monthly Prompt Credits : ${planInfo.monthlyPromptCredits ?? "-"}`);
            console.log(`  Monthly Flow Credits   : ${planInfo.monthlyFlowCredits ?? "-"}`);
            console.log(`  Can Buy More Credits   : ${planInfo.canBuyMoreCredits ?? "-"}`);
        } else {
            console.log("  (No plan info available)");
        }

        // ── Plan Status (Credits) ──
        console.log();
        console.log("═".repeat(50));
        console.log("  💳 Credit Status");
        console.log("═".repeat(50));

        if (planStatus) {
            const promptAvail = Number(planStatus.availablePromptCredits ?? 0);
            const promptUsed = Number(planStatus.usedPromptCredits ?? 0);
            const flowAvail = Number(planStatus.availableFlowCredits ?? 0);
            const flowUsed = Number(planStatus.usedFlowCredits ?? 0);
            const flexAvail = Number(planStatus.availableFlexCredits ?? 0);
            const flexUsed = Number(planStatus.usedFlexCredits ?? 0);

            const promptTotal = promptAvail + promptUsed;
            const flowTotal = flowAvail + flowUsed;

            const bar = (used: number, total: number, width: number = 20) => {
                if (total === 0) return "░".repeat(width) + " (unlimited?)";
                const filled = Math.min(width, Math.round((used / total) * width));
                return "█".repeat(filled) + "░".repeat(width - filled) + ` ${used}/${total}`;
            };

            console.log();
            console.log(`  Prompt Credits:`);
            console.log(`    Available : ${promptAvail}`);
            console.log(`    Used      : ${promptUsed}`);
            console.log(`    ${bar(promptUsed, promptTotal)}`);

            console.log();
            console.log(`  Flow Credits:`);
            console.log(`    Available : ${flowAvail}`);
            console.log(`    Used      : ${flowUsed}`);
            console.log(`    ${bar(flowUsed, flowTotal)}`);

            console.log();
            console.log(`  Flex Credits:`);
            console.log(`    Available : ${flexAvail}`);
            console.log(`    Used      : ${flexUsed}`);
            console.log(`    ${bar(flexUsed, flexAvail + flexUsed)}`);

            // Plan period (Timestamp handling)
            if (planStatus.planStart || planStatus.planEnd) {
                console.log();
                const parseDate = (ts: any) => {
                    if (!ts) return "-";
                    const seconds = ts.seconds ?? ts; // Facade では数値で来る場合もあるため
                    return new Date(Number(seconds) * 1000).toLocaleDateString("ja-JP");
                };
                console.log(`  Plan Period : ${parseDate(planStatus.planStart)} ~ ${parseDate(planStatus.planEnd)}`);
            }
        } else {
            console.log("  (No plan status available)");
        }

        // ── User-level cumulative usage ──
        const userPrompt = us.userUsedPromptCredits;
        const userFlow = us.userUsedFlowCredits;

        if (userPrompt !== undefined || userFlow !== undefined) {
            console.log();
            console.log("═".repeat(50));
            console.log("  📊 Cumulative Usage (User-level)");
            console.log("═".repeat(50));
            console.log(`  Total Prompt Credits Used : ${userPrompt ?? "-"}`);
            console.log(`  Total Flow Credits Used   : ${userFlow ?? "-"}`);
        }

        // ── Per-model quota info ──
        const configs = us.cascadeModelConfigData?.clientModelConfigs || [];
        const modelsWithQuota = configs.filter(m => m.quotaInfo);

        if (modelsWithQuota.length > 0) {
            console.log();
            console.log("═".repeat(50));
            console.log("  🔋 Per-Model Quota");
            console.log("═".repeat(50));

            for (const m of modelsWithQuota) {
                const label = m.label || "(unknown)";
                const qi = m.quotaInfo!;
                const remaining = qi.remainingFraction != null
                    ? `${(qi.remainingFraction * 100).toFixed(1)}%`
                    : "-";

                const resetTime = qi.resetTime
                    ? new Date(Number((qi.resetTime as any).seconds ?? qi.resetTime) * 1000).toLocaleString("ja-JP")
                    : "-";

                console.log(`  ${label}`);
                console.log(`    Remaining : ${remaining}`);
                console.log(`    Reset At  : ${resetTime}`);
            }
        }

        // ── Other flags ──
        console.log();
        console.log("═".repeat(50));
        console.log("  ℹ️  Account Info");
        console.log("═".repeat(50));
        console.log(`  Pro             : ${us.pro ?? "-"}`);
        console.log(`  Has Used AG     : ${us.hasUsedAntigravity ?? "-"}`);

        console.log();
    } catch (e) {
        console.error("❌ Error during quota check:", e);
    }
}

main();
