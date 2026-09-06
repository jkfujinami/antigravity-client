import { extractDescriptors } from "../scripts/lib/extractor";
const n = (p:string)=>new Set(extractDescriptors(p).map(d=>d.proto.name!));
const saved = n("resource/extension_formatted.js");
const live  = n("/Applications/Antigravity IDE.app/Contents/Resources/app/extensions/antigravity/dist/extension.js");
console.log("NEW in live (not in saved):", [...live].filter(x=>!saved.has(x)));
console.log("GONE from live (in saved only):", [...saved].filter(x=>!live.has(x)));
