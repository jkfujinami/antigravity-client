import { AntigravityClient } from "../src/index.js";
import {
  SendUserCascadeMessageRequest,
} from "../src/gen/exa/language_server_pb/language_server_pb.js";
import {
  CascadeConfig, CascadePlannerConfig, CascadeConversationalPlannerConfig,
} from "../src/gen/exa/cortex_pb/cortex_pb.js";
import { Metadata, TextOrScopeItem, ModelOrAlias } from "../src/gen/exa/codeium_common_pb/codeium_common_pb.js";

const sleep = (ms:number)=>new Promise(r=>setTimeout(r,ms));

function cfg(modelId:number){
  return new CascadeConfig({ plannerConfig: new CascadePlannerConfig({
    plannerTypeConfig:{case:"conversational",value:new CascadeConversationalPlannerConfig({plannerMode:1})},
    requestedModel:new ModelOrAlias({choice:{case:"model",value:modelId}}),
  })});
}

async function main(){
  const client = await AntigravityClient.connect();
  const models = await client.getAvailableModels();
  // pick a flash model id
  const flash = Object.entries(models).find(([k])=>/flash/i.test(k))?.[1] as any;
  const modelId = flash?.modelId ?? Object.values(models).find((m:any)=>m.modelId!=null) as any;
  console.log("using modelId:", flash?.modelId, "(", Object.keys(models).find(k=>/flash/i.test(k)),")");

  const cascade = await client.startCascade();
  console.log("cascadeId:", cascade.cascadeId);
  let lastText=""; let statuses:string[]=[];
  cascade.on("text",(e:any)=>{lastText+=e.delta;});
  cascade.on("statusChange",(e:any)=>{statuses.push(`${e.previousStatus}->${e.status}`);});

  async function turn(label:string, req:SendUserCascadeMessageRequest, waitMs=25000){
    lastText=""; statuses=[];
    const t0=Date.now();
    let resp:any, err:any;
    try{ resp = await client.lsClient.sendUserCascadeMessage(req); }catch(e:any){ err=e; }
    const rpcMs=Date.now()-t0;
    // wait for idle
    const start=Date.now();
    while(Date.now()-start<waitMs){ if(statuses.some(s=>s.endsWith("->idle"))&&Date.now()-t0>1500) break; await sleep(300); }
    console.log(`\n=== ${label} ===`);
    console.log(`  rpc returned in ${rpcMs}ms; err=${err?String(err.message||err).slice(0,120):"none"}`);
    console.log(`  response = ${err?"(threw)":JSON.stringify(resp?.toJson?.()??resp)}`);
    console.log(`  statuses = ${statuses.join(", ")||"(none)"}`);
    console.log(`  text     = ${JSON.stringify(lastText.slice(0,80))}`);
    await sleep(1500);
  }

  const md = new Metadata({ apiKey: (client as any).apiKey, ideName:"vscode", ideVersion:"1.107.0", extensionName:"antigravity", extensionVersion:"0.2.0" });
  const items=(t:string)=>[new TextOrScopeItem({chunk:{case:"text",value:t}})];

  // E1: WITH metadata + config (control)
  await turn("E1 control (metadata+config)", new SendUserCascadeMessageRequest({
    cascadeId:cascade.cascadeId, metadata:md, items:items("Reply with exactly: A1"), cascadeConfig:cfg(flash.modelId), blocking:false, clientType:1 }));

  // E2: WITHOUT metadata (is deprecated field actually required?)
  await turn("E2 no metadata", new SendUserCascadeMessageRequest({
    cascadeId:cascade.cascadeId, items:items("Reply with exactly: A2"), cascadeConfig:cfg(flash.modelId), blocking:false, clientType:1 }));

  // E3: WITHOUT cascadeConfig (is model/config required?)
  await turn("E3 no cascadeConfig", new SendUserCascadeMessageRequest({
    cascadeId:cascade.cascadeId, metadata:md, items:items("Reply with exactly: A3"), blocking:false, clientType:1 }));

  // E4: blocking:true (does RPC block until turn done?)
  await turn("E4 blocking=true", new SendUserCascadeMessageRequest({
    cascadeId:cascade.cascadeId, metadata:md, items:items("Reply with exactly: A4"), cascadeConfig:cfg(flash.modelId), blocking:true, clientType:1 }));

  client.dispose?.();
  process.exit(0);
}
main().catch(e=>{console.error("FATAL",e);process.exit(1);});
