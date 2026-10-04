import { AntigravityClient } from "../src/index.js";
import { StreamReactiveUpdatesRequest } from "../src/gen/exa/reactive_component_pb/reactive_component_pb.js";
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function main(){
  const client=await AntigravityClient.connect();
  const cascade=await client.startCascade();
  const id=cascade.cascadeId;
  console.log("cascadeId:",id);
  const ac=new AbortController();
  let frames=0;
  (async()=>{
    try{
      for await(const res of client.lsClient.streamCascadeReactiveUpdates(new StreamReactiveUpdatesRequest({protocolVersion:1,id}),{signal:ac.signal})){
        frames++;
        const fds=res.diff?.fieldDiffs||[];
        const kinds=fds.map(f=>`#${f.fieldNumber}:${f.diff.case}`).join(",");
        if(frames<=12) console.log(`  frame#${frames} v=${res.version} diffs=${fds.length} [${kinds}]`);
      }
    }catch(e:any){ if(!ac.signal.aborted) console.log("  stream err:",String(e.message||e).slice(0,140)); }
  })();
  await sleep(1500);
  console.log("→ sending a message…");
  await cascade.sendMessage("Reply with exactly: HELLO");
  await cascade.waitForTurnComplete?.({timeoutMs:25000}).catch(()=>{});
  await sleep(1500);
  ac.abort();
  console.log(`TOTAL reactive frames: ${frames}`);
  process.exit(0);
}
main().catch(e=>{console.error("FATAL",e);process.exit(1);});
