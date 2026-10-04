import { AntigravityClient } from "../src/index.js";
import { StartAudioTranscriptionRequest } from "../src/gen/exa/language_server_pb/language_server_pb.js";
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function main(){
  const client:any=await AntigravityClient.connect();
  const cascade=await client.startCascade();
  const ac=new AbortController();let got="";
  (async()=>{try{
    for await(const r of client.lsClient.streamAudioTranscription(new StartAudioTranscriptionRequest({mimeType:"audio/webm;codecs=opus",model:"",cascadeId:cascade.cascadeId}),{signal:ac.signal})){
      const j:any=(r as any).toJson?.()??r; console.log("  frame:",JSON.stringify(j).slice(0,120));
      if((r as any).message?.case)got=(r as any).message.case;
      if(got==="ready"||got)break;
    }
  }catch(e:any){if(!ac.signal.aborted)console.log("  err:",String(e.message).slice(0,120));}})();
  await sleep(4000); ac.abort();
  console.log("  → first frame case:",got||"(none within 4s)");
  process.exit(0);
}
main().catch(e=>{console.error("FATAL",String(e).slice(0,150));process.exit(1);});
