import { FileDescriptorProto } from "@bufbuild/protobuf";
import { extractDescriptors } from "../scripts/lib/extractor";
import { computeDiff } from "../scripts/lib/schema_diff";
const toMap=(p:string)=>{const m=new Map<string,any>();for(const d of extractDescriptors(p))m.set(d.proto.name!,d.proto);return m;};
const diff=computeDiff(toMap("resource/extension_formatted.js"),toMap("/Applications/Antigravity IDE.app/Contents/Resources/app/extensions/antigravity/dist/extension.js"));
console.log("addedServices:",diff.addedServices);
console.log("removedServices:",diff.removedServices);
for(const s of diff.changedServices){
  console.log(`\nSERVICE ${s.fullName}`);
  console.log("  +methods:",s.addedMethods.map((m:any)=>m.name));
  console.log("  -methods:",s.removedMethods.map((m:any)=>m.name));
  if(s.changedMethods.length)console.log("  ~methods:",s.changedMethods);
}
console.log("\nenums added:",diff.addedEnums.length,"removed:",diff.removedEnums.length,"changed:",diff.changedEnums.length);
