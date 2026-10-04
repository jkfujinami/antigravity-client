import { extractDescriptors } from "../scripts/lib/extractor";
const re=/audio|transcri|voice|speech|mic|sound|media/i;
for(const d of extractDescriptors("resource/extension_formatted.js"))
  for(const s of d.proto.service||[]) if(s.name==="LanguageServerService")
    for(const m of s.method||[]) if(re.test(m.name!))
      console.log(`${m.serverStreaming?"→srv":""}${m.clientStreaming?"←cli":""}${!m.serverStreaming&&!m.clientStreaming?"unary":""}  ${m.name}\n    in : ${(m.inputType||"").replace(/^\./,"")}\n    out: ${(m.outputType||"").replace(/^\./,"")}`);
