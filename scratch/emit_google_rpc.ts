import * as fs from "fs";
import * as path from "path";
import { extractDescriptors } from "../scripts/lib/extractor";
import { buildKnownTypes, buildTypeToFile, renderProtoFile } from "../scripts/lib/proto_printer";

// collect all descriptors (same as extract)
const all = new Map<string, any>();
for (const b of ["resource/extension_formatted.js", "resource/chat_formatted.js"]) {
  if (!fs.existsSync(b)) continue;
  for (const d of extractDescriptors(b)) {
    const n = d.proto.name;
    if (n && d.proto.package) {
      const e = all.get(n);
      if (!e || d.proto.messageType.length > e.messageType.length) all.set(n, d.proto);
    }
  }
}
const known = buildKnownTypes(all);
const t2f = buildTypeToFile(all);

const OUT = "src/proto_generated";
const targets = ["google/rpc/error_details.proto", "google/rpc/status.proto"];
for (const name of targets) {
  const desc = all.get(name);
  if (!desc) { console.log("MISSING descriptor:", name); continue; }
  const text = renderProtoFile(desc, name, known, t2f);
  const fp = path.join(OUT, name);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, text, "utf8");
  console.log("wrote:", fp);
}
