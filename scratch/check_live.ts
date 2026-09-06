import { FileDescriptorProto } from "@bufbuild/protobuf";
import { extractDescriptors } from "../scripts/lib/extractor";
import { computeDiff, analyzeImpact, printReport } from "../scripts/lib/schema_diff";

const OLD = "resource/extension_formatted.js"; // saved
const NEW = "/Applications/Antigravity IDE.app/Contents/Resources/app/extensions/antigravity/dist/extension.js"; // live updated

function toMap(p: string) {
  const m = new Map<string, InstanceType<typeof FileDescriptorProto>>();
  for (const d of extractDescriptors(p)) m.set(d.proto.name!, d.proto);
  return m;
}

console.log("=== EXTRACTION CHECK ===");
const oldM = toMap(OLD);
const newM = toMap(NEW);
console.log(`saved extension_formatted.js : ${oldM.size} descriptors`);
console.log(`live  extension.js (updated) : ${newM.size} descriptors`);
console.log("→ extraction from live bundle: OK\n");

const diff = computeDiff(oldM, newM);
const impacts = analyzeImpact(diff, newM);
printReport(diff, impacts);
