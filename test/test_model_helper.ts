import { AntigravityClient } from "../src/client.js";
import { Model, ModelAlias } from "../src/gen/exa/codeium_common_pb/codeium_common_pb.js";

async function main() {
    try {
        console.log("🔌 Connecting...");
        const client = await AntigravityClient.connect();

        console.log("📡 Fetching user status...\n");
        const userStatus = await client.getUserStatus();
        const configs = userStatus.userStatus?.cascadeModelConfigData?.clientModelConfigs || [];

        if (configs.length === 0) {
            console.log("⚠️  No models found.");
            return;
        }

        // Build rows
        const rows: { label: string; name: string; id: string; type: string; premium: string; recommended: string; disabled: string }[] = [];

        for (const m of configs as any[]) {
            const label = m.label || "(no label)";
            const choice = m.modelOrAlias?.choice;

            let name = "-";
            let id: string | number = "-";
            let type = "-";

            if (choice) {
                if (choice.case === "model") {
                    name = Model[choice.value] || `Unknown(${choice.value})`;
                    id = choice.value;
                    type = "model";
                } else if (choice.case === "alias") {
                    name = ModelAlias[choice.value] || `Unknown(${choice.value})`;
                    id = choice.value;
                    type = "alias";
                }
            }

            rows.push({
                label,
                name,
                id: String(id),
                type,
                premium: m.isPremium ? "✓" : "",
                recommended: m.isRecommended ? "✓" : "",
                disabled: m.disabled ? "✗" : "",
            });
        }

        // Calculate column widths
        const cols = {
            label: Math.max(5, ...rows.map(r => r.label.length)),
            name: Math.max(10, ...rows.map(r => r.name.length)),
            id: Math.max(2, ...rows.map(r => r.id.length)),
            type: Math.max(4, ...rows.map(r => r.type.length)),
        };

        const pad = (s: string, w: number) => s + " ".repeat(Math.max(0, w - s.length));
        const sep = `${"─".repeat(cols.label + 2)}┼${"─".repeat(cols.name + 2)}┼${"─".repeat(cols.id + 2)}┼${"─".repeat(cols.type + 2)}┼────┼────┼────`;

        // Header
        console.log(`${pad("Label", cols.label)}  │ ${pad("Model Name", cols.name)} │ ${pad("ID", cols.id)} │ ${pad("Type", cols.type)} │ 💎 │ ⭐ │ 🚫`);
        console.log(sep);

        // Rows
        for (const r of rows) {
            const premStr = r.premium ? " ✓ " : "   ";
            const recStr = r.recommended ? " ✓ " : "   ";
            const disStr = r.disabled ? " ✗ " : "   ";
            console.log(`${pad(r.label, cols.label)}  │ ${pad(r.name, cols.name)} │ ${pad(r.id, cols.id)} │ ${pad(r.type, cols.type)} │${premStr}│${recStr}│${disStr}`);
        }

        console.log(sep);
        console.log(`\nTotal: ${rows.length} models`);
        console.log(`  💎 = Premium  ⭐ = Recommended  🚫 = Disabled`);

    } catch (e) {
        console.error("❌ Error:", e);
    }
}

main();
