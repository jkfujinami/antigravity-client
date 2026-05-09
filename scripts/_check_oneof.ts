import { CustomAgentSpec } from "../src/gen/exa/cortex_pb/cortex_pb.js";
const fields = CustomAgentSpec.fields.list();
for (const f of fields) {
    if (f.oneof) {
        console.log(`${f.name} → oneof type: ${typeof f.oneof}, name: ${f.oneof?.name}, keys: ${Object.keys(f.oneof)}`);
    }
}
