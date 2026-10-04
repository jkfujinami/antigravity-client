import { extractDescriptors } from "../scripts/lib/extractor";
const re=/synth|speak|tts|text_to_speech|voice_out|speech_synth/i;
let found=false;
for(const d of extractDescriptors("resource/extension_formatted.js"))
  for(const s of d.proto.service||[])
    for(const m of s.method||[]) if(re.test(m.name!)){console.log("  ",s.name,m.name);found=true;}
if(!found)console.log("  (none — no server-side TTS)");
