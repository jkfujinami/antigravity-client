import { extractDescriptors } from "../scripts/lib/extractor";
const want=["StreamCascadeReactiveUpdates","StreamAgentStateUpdates","StreamCascadePanelReactiveUpdates","StreamCascadeSummariesReactiveUpdates","StreamUserTrajectoryReactiveUpdates"];
for(const d of extractDescriptors("resource/extension_formatted.js"))
  for(const s of d.proto.service||[]) if(s.name==="LanguageServerService")
    for(const m of s.method||[]) if(want.includes(m.name!))
      console.log(`${m.name}  ${m.clientStreaming?"cstream ":""}${m.serverStreaming?"→server-stream":""}\n    in:  ${(m.inputType||"").replace(/^\./,"")}\n    out: ${(m.outputType||"").replace(/^\./,"")}`);
