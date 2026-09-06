import { extractDescriptors } from "../scripts/lib/extractor";
function stepCases(bundle: string): string[] {
  for (const d of extractDescriptors(bundle)) {
    if (!d.proto.name?.includes("trajectory")) continue;
    for (const m of d.proto.messageType) {
      if (m.name !== "Step") continue;
      // fields inside the 'step' oneof
      return m.field.filter(f => f.oneofIndex !== undefined).map(f => f.name!);
    }
  }
  return [];
}
const oldC = stepCases("resource/extension_formatted.js");
const newC = stepCases("/Applications/Antigravity IDE.app/Contents/Resources/app/extensions/antigravity/dist/extension.js");
const added = newC.filter(c => !oldC.includes(c));
const removed = oldC.filter(c => !newC.includes(c));
console.log(`Step oneof cases: old=${oldC.length} new=${newC.length}`);
console.log(`ADDED step cases (${added.length}):`, added);
console.log(`REMOVED step cases (${removed.length}):`, removed);
