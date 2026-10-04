import { AntigravityClient } from "../src/index.js";
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function main(){
  const client=await AntigravityClient.connect();
  const cascade=await client.startCascade();  // auto-listens w/ subscriberId=cascadeId
  const id=cascade.cascadeId;
  console.log("cascadeId:",id);
  const ac=new AbortController();let n=0;
  (async()=>{try{
    for await(const r of client.lsClient.streamAgentStateUpdates({conversationId:id,subscriberId:id+"-probe",trajectoryVerbosity:3} as any,{signal:ac.signal})){
      n++;const u=(r as any).update;
      const su=u?.mainTrajectoryUpdate?.stepsUpdate;
      const stepTypes=(su?.steps||[]).map((s:any)=>s.step?.case).join(",");
      if(n<=10)console.log(`  frame#${n}: status=${u?.status} execStatus=${u?.executableStatus} idx=[${(su?.indices||[]).join(",")}] total=${su?.totalLength} steps={${stepTypes}}`);
    }
  }catch(e:any){if(!ac.signal.aborted)console.log("  err",String(e.message).slice(0,90));}})();
  await sleep(1500);
  console.log("→ send");
  await cascade.sendMessage("Reply with exactly: HI");
  await sleep(7000); ac.abort();
  console.log(`TOTAL AgentState frames: ${n}`);
  process.exit(0);
}
main().catch(e=>{console.error("FATAL",String(e).slice(0,120));process.exit(1);});
