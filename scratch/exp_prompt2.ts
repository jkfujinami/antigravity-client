import { AntigravityClient } from "../src/index.js";
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function main(){
  const client=await AntigravityClient.connect();
  const cascade=await client.startCascade();
  const id=cascade.cascadeId;
  console.log("cascadeId:",id);
  const ac=new AbortController();
  let captured:any=null;
  (async()=>{try{
    for await(const r of client.lsClient.streamAgentStateUpdates({conversationId:id,subscriberId:id+"-probe",trajectoryVerbosity:3} as any,{signal:ac.signal})){
      const gmu=(r as any).update?.mainTrajectoryUpdate?.generatorMetadatasUpdate;
      if(gmu?.generatorMetadatas?.length){
        for(const gm of gmu.generatorMetadatas){
          const cm=gm.chatModel;
          if(cm && (cm.systemPrompt || cm.promptSections?.length)){ captured=cm; }
        }
      }
    }
  }catch(e:any){if(!ac.signal.aborted)console.log("err",String(e.message).slice(0,80));}})();
  await sleep(1500);
  await cascade.run("Say: PONG",{timeoutMs:30000});
  await sleep(2000);
  ac.abort();
  if(!captured){console.log("NO chat_model with prompt captured");process.exit(0);}
  console.log("\n=== CAPTURED system prompt ===");
  console.log("  systemPrompt length:",captured.systemPrompt?.length||0,"chars");
  console.log("  usage input=",captured.usage?.inputTokens,"output=",captured.usage?.outputTokens);
  console.log(`  prompt_sections (${captured.promptSections?.length||0}):`);
  for(const ps of captured.promptSections||[]) console.log(`     - "${ps.title}"  (${(ps.content||ps.templatedContent||"").length} chars) internal=${ps.metadata?.isInternal}`);
  // save full system prompt
  const fs=await import("fs"); fs.writeFileSync("scratch/captured_system_prompt.txt", captured.systemPrompt||"(none)");
  console.log("\n(system prompt saved to scratch/captured_system_prompt.txt)");
  process.exit(0);
}
main().catch(e=>{console.error("FATAL",String(e).slice(0,200));process.exit(1);});
