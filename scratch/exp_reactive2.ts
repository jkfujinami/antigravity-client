import { AntigravityClient } from "../src/index.js";
import { StreamReactiveUpdatesRequest } from "../src/gen/exa/reactive_component_pb/reactive_component_pb.js";
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function probe(client:any,fn:string,req:any,label:string){
  const ac=new AbortController();let n=0,err="";
  const p=(async()=>{try{for await(const r of client.lsClient[fn](req,{signal:ac.signal})){n++;if(n>=1)break;}}catch(e:any){err=String(e.message||e).slice(0,80);}})();
  await Promise.race([p,sleep(4000)]);ac.abort();
  console.log(`  ${label}: frames=${n} ${err?("ERR="+err):"OK"}`);
}
async function main(){
  const client=await AntigravityClient.connect();
  const cascade=await client.startCascade();
  const id=cascade.cascadeId;
  console.log("cascadeId:",id);
  await probe(client,"streamCascadeReactiveUpdates",new StreamReactiveUpdatesRequest({protocolVersion:1,id}),"CascadeReactive(id=cascadeId)");
  await probe(client,"streamCascadeSummariesReactiveUpdates",new StreamReactiveUpdatesRequest({protocolVersion:1,id:"summaries"}),"SummariesReactive");
  await probe(client,"streamCascadePanelReactiveUpdates",new StreamReactiveUpdatesRequest({protocolVersion:1,id}),"PanelReactive");
  // StreamAgentStateUpdates (the modern one)
  const ac=new AbortController();let n=0;
  (async()=>{try{for await(const r of client.lsClient.streamAgentStateUpdates({conversationId:id,subscriberId:id,trajectoryVerbosity:3} as any,{signal:ac.signal})){n++;const u=(r as any).update;if(n<=4)console.log(`    AgentState frame#${n}: status=${u?.status} steps=${u?.mainTrajectoryUpdate?.stepsUpdate?.steps?.length??0} totalLen=${u?.mainTrajectoryUpdate?.stepsUpdate?.totalLength}`);}}catch(e:any){if(!ac.signal.aborted)console.log("    AgentState err",String(e.message).slice(0,80));}})();
  await sleep(1500); await cascade.sendMessage("Reply with exactly: HI"); await sleep(6000); ac.abort();
  console.log(`  AgentState TOTAL frames during turn: ${n}`);
  process.exit(0);
}
main().catch(e=>{console.error("FATAL",e);process.exit(1);});
