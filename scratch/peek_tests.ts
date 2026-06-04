import fs from "fs";
import path from "path";

const testDir = path.join(process.cwd(), "test");
const files = fs.readdirSync(testDir).filter(f => f.endsWith(".ts"));

for (const file of files) {
    const content = fs.readFileSync(path.join(testDir, file), "utf8");
    const lines = content.split("\n").slice(0, 15).join("\n");
    console.log(`\n=== ${file} ===\n${lines}`);
}
