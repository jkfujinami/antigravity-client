import { AntigravityClient } from "../src/index.js";
async function main(){
  const client=await AntigravityClient.connect();
  const cascade=await client.startCascade();
  console.log("cascadeId:",cascade.cascadeId);
  await cascade.run("Write a haiku about TypeScript.",{timeoutMs:30000});
  // pull full history to ensure metadata present
  await cascade.getHistory().catch(()=>{});
  const steps=(cascade.state.trajectory?.steps||[]);
  console.log(`\nsteps: ${steps.length}`);
  let tin=0n,tout=0n,tthink=0n,tcr=0n,tcw=0n; let cost=0, flow=0, prompt=0;
  for(let i=0;i<steps.length;i++){
    const s:any=steps[i]; const m=s.metadata; const mu=m?.modelUsage;
    if(mu){
      tin+=mu.inputTokens||0n; tout+=mu.outputTokens||0n; tthink+=mu.thinkingOutputTokens||0n; tcr+=mu.cacheReadTokens||0n; tcw+=mu.cacheWriteTokens||0n;
    }
    if(m){ cost+=m.modelCost||0; flow+=m.flowCreditsUsed||0; prompt+=m.promptCreditsUsed||0; }
    if(mu||m?.modelCost) console.log(`  [${i}] ${s.step?.case}: model=${mu?.model} in=${mu?.inputTokens} out=${mu?.outputTokens} think=${mu?.thinkingOutputTokens} cacheR=${mu?.cacheReadTokens} cost=${m?.modelCost} flowCr=${m?.flowCreditsUsed} promptCr=${m?.promptCreditsUsed}`);
  }
  console.log(`\n=== TOTALS ===`);
  console.log(`  input=${tin} output=${tout} thinking=${tthink} cacheRead=${tcr} cacheWrite=${tcw}`);
  console.log(`  modelCost=${cost.toFixed(6)} flowCredits=${flow} promptCredits=${prompt}`);
  process.exit(0);
}
main().catch(e=>{console.error("FATAL",String(e).slice(0,150));process.exit(1);});
