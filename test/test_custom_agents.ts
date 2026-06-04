import { AntigravityClient } from "../src/client.js";
import { GetAllWorkflowsRequest, GetAllSkillsRequest, GetWorkingDirectoriesRequest } from "../src/gen/exa/language_server_pb/language_server_pb.js";

async function main() {
    try {
        console.log("Connecting to Antigravity LS...");
        const client = await AntigravityClient.connect({ autoDetect: true });

        // Get working directories
        const wdRes = await client.lsClient.getWorkingDirectories(new GetWorkingDirectoriesRequest());
        const uris = (wdRes.directories || []).map(wd => wd.absoluteUri);
        console.log("Working URIs:", uris);

        // 1. GetAllWorkflows
        try {
            console.log("\n--- Calling GetAllWorkflows ---");
            const res = await client.lsClient.getAllWorkflows(new GetAllWorkflowsRequest({ workspaceUris: uris }));
            console.log(`Found ${res.workflows.length} workflows.`);
            res.workflows.forEach(w => {
                console.log(`\n- Name: ${w.name}`);
                console.log(`  Description: ${w.description}`);
            });
        } catch (e: any) {
            console.log("GetAllWorkflows failed:", e.message);
        }

        // 2. GetAllSkills
        try {
            console.log("\n--- Calling GetAllSkills ---");
            const res = await client.lsClient.getAllSkills(new GetAllSkillsRequest({ workspaceUris: uris }));
            console.log(`Found ${res.skills.length} skills.`);
            res.skills.forEach(s => console.log(` - ${s.name}`));
        } catch (e: any) {
            console.log("GetAllSkills failed:", e.message);
        }

    } catch (e) {
        console.error("Error:", e);
    }
}

main();
