import * as fs from "fs-extra";
import * as path from "path";
import { execSync } from "child_process";
import { computeDiff, analyzeImpact, printReport } from "./lib/schema_diff.js";
import { FileDescriptorProto, FileDescriptorSet } from "@bufbuild/protobuf";

async function main() {
    const oldDir = process.argv[2];
    const newDir = process.argv[3];

    if (!oldDir || !newDir) {
        console.error("Usage: npx tsx scripts/compare_schemas.ts <old_dir> <new_dir>");
        process.exit(1);
    }

    const oldJsonPath = path.join("/tmp", "old_image.json");
    const newJsonPath = path.join("/tmp", "new_image.json");

    console.log(`Building old schemas from ${oldDir}...`);
    execSync(`npx buf build ${oldDir} -o ${oldJsonPath}`, { stdio: "inherit" });

    console.log(`Building new schemas from ${newDir}...`);
    execSync(`npx buf build ${newDir} -o ${newJsonPath}`, { stdio: "inherit" });

    const oldData = await fs.readJson(oldJsonPath);
    const newData = await fs.readJson(newJsonPath);

    const oldMap = new Map<string, any>();
    for (const f of oldData.file) {
        oldMap.set(f.name, f);
    }

    const newMap = new Map<string, any>();
    for (const f of newData.file) {
        newMap.set(f.name, f);
    }

    console.log("\nAnalyzing differences...");
    const diff = computeDiff(oldMap, newMap);
    const impacts = analyzeImpact(diff, newMap);

    printReport(diff, impacts);
}

main().catch(console.error);
