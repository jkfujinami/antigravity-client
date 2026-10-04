import { AntigravityClient } from "../src/index.js";
import { SendUserCascadeMessageRequest } from "../src/gen/exa/language_server_pb/language_server_pb.js";
import { CascadeConfig, CascadePlannerConfig, CascadeConversationalPlannerConfig } from "../src/gen/exa/cortex_pb/cortex_pb.js";
import { Metadata, TextOrScopeItem, ModelOrAlias, ContextScopeItem, FileLineRange } from "../src/gen/exa/codeium_common_pb/codeium_common_pb.js";
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const cfg=(id:number)=>new CascadeConfig({plannerConfig:new CascadePlannerConfig({plannerTypeConfig:{case:"conversational",value:new CascadeConversationalPlannerConfig({plannerMode:1})},requestedModel:new ModelOrAlias({choice:{case:"model",value:id}})})});
async function main(){
  const client=await AntigravityClient.connect();
  const models=await client.getAvailableModels();
  const flash=Object.entries(models).find(([k])=>/flash/i.test(k))![1] as any;
  const cascade=await client.startCascade();
  let text="";let statuses:string[]=[];
  cascade.on("text",(e:any)=>{text+=e.delta;});cascade.on("statusChange",(e:any)=>{statuses.push(e.status);});
  async function turn(label:string,items:TextOrScopeItem[],waitMs=45000){
    text="";statuses=[];const t0=Date.now();
    await client.lsClient.sendUserCascadeMessage(new SendUserCascadeMessageRequest({cascadeId:cascade.cascadeId,cascadeConfig:cfg(flash.modelId),clientType:1,items}));
    const s=Date.now();while(Date.now()-s<waitMs){if(statuses.includes("idle")&&Date.now()-t0>1500)break;await sleep(300);}
    console.log(`\n=== ${label} ===\n  statuses=${statuses.join(",")}\n  text = ${JSON.stringify(text.slice(0,160))}`);await sleep(1200);
  }
  const t=(x:string)=>new TextOrScopeItem({chunk:{case:"text",value:x}});
  const s=(v:ContextScopeItem)=>new TextOrScopeItem({chunk:{case:"item",value:v}});
  const uri="file://"+process.cwd()+"/README.md";
  // fileLineRange: attach only lines 3-3 (the H1 "# Antigravity Client")
  await turn("fileLineRange L3-5",[
    s(new ContextScopeItem({scopeItem:{case:"fileLineRange",value:new FileLineRange({absoluteUri:uri,startLine:3,endLine:5})}})),
    t("The attachment is a small slice of a file. Quote verbatim the exact text lines you were given, nothing else."),
  ]);
  process.exit(0);
}
main().catch(e=>{console.error("FATAL",e);process.exit(1);});
