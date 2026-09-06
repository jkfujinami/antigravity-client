import { extractDescriptors } from "../scripts/lib/extractor";

function names(p: string): Set<string> {
  try { return new Set(extractDescriptors(p).map(d => d.proto.name!)); }
  catch (e) { return new Set(); }
}

const ext = names("resource/extension_formatted.js");
const chat = names("resource/chat_formatted.js");
const chatOnly = [...chat].filter(n => !ext.has(n));
console.log(`extension_formatted: ${ext.size} descriptors`);
console.log(`chat_formatted:      ${chat.size} descriptors`);
console.log(`chat-ONLY (${chatOnly.length}):`, chatOnly);

const IDE = "/Applications/Antigravity IDE.app/Contents/Resources/app";
const candidates = [
  `${IDE}/extensions/antigravity/dist/extension.js`,
  `${IDE}/out/vs/workbench/workbench.desktop.main.js`,
  `${IDE}/out/main.js`,
  `${IDE}/out/jetskiAgent/main.js`,
];
for (const c of candidates) {
  const n = names(c);
  const coversChat = [...chat].filter(x => n.has(x)).length;
  const coversExt  = [...ext].filter(x => n.has(x)).length;
  console.log(`\n${c.replace(IDE,"…")}`);
  console.log(`   total=${n.size}  covers chat=${coversChat}/${chat.size}  covers ext=${coversExt}/${ext.size}`);
}
