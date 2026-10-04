import { AntigravityClient } from "../src/index.js";
import { SendUserCascadeMessageRequest } from "../src/gen/exa/language_server_pb/language_server_pb.js";
import { CascadeConfig, CascadePlannerConfig, CascadeConversationalPlannerConfig } from "../src/gen/exa/cortex_pb/cortex_pb.js";
import { Metadata, TextOrScopeItem, ModelOrAlias, ContextScopeItem, TextBlock, PathScopeItem } from "../src/gen/exa/codeium_common_pb/codeium_common_pb.js";
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const cfg=(id:number)=>new CascadeConfig({plannerConfig:new CascadePlannerConfig({plannerTypeConfig:{case:"conversational",value:new CascadeConversationalPlannerConfig({plannerMode:1})},requestedModel:new ModelOrAlias({choice:{case:"model",value:id}})})});
async function main(){
  const client=await AntigravityClient.connect();
  const models=await client.getAvailableModels();
  const flash=Object.entries(models).find(([k])=>/flash/i.test(k))![1] as any;
  const cascade=await client.startCascade();
  console.log("cascadeId:",cascade.cascadeId,"model:",flash.modelId);
  let text=""; let statuses:string[]=[];
  cascade.on("text",(e:any)=>{text+=e.delta;});
  cascade.on("statusChange",(e:any)=>{statuses.push(e.status);});
  async function turn(label:string,req:SendUserCascadeMessageRequest,waitMs=30000){
    text="";statuses=[];const t0=Date.now();let err:any,resp:any;
    try{resp=await client.lsClient.sendUserCascadeMessage(req);}catch(e:any){err=e;}
    const start=Date.now();
    while(Date.now()-start<waitMs){if(statuses.includes("idle")&&Date.now()-t0>1500)break;await sleep(300);}
    console.log(`\n=== ${label} ===`);
    console.log(`  rpc ${Date.now()-t0}ms err=${err?String(err.message).slice(0,100):"none"}`);
    console.log(`  text = ${JSON.stringify(text.slice(0,120))}`);
    await sleep(1200);
  }
  const md=new Metadata({apiKey:(client as any).apiKey,ideName:"vscode",ideVersion:"1.107.0",extensionName:"antigravity",extensionVersion:"0.2.0"});
  const textItem=(t:string)=>new TextOrScopeItem({chunk:{case:"text",value:t}});
  const scopeItem=(v:ContextScopeItem)=>new TextOrScopeItem({chunk:{case:"item",value:v}});

  // E5: TextBlock injection
  await turn("E5 textBlock scope item", new SendUserCascadeMessageRequest({
    cascadeId:cascade.cascadeId, metadata:md, cascadeConfig:cfg(flash.modelId), blocking:false, clientType:1,
    items:[
      scopeItem(new ContextScopeItem({scopeItem:{case:"textBlock",value:new TextBlock({content:"REMEMBER_TOKEN=Zorp99",label:"note"})}})),
      textItem("Repeat the exact token value from the attached note. Reply with only the value."),
    ]}));

  // E6: file scope item (attach README.md)
  const fileUri="file://"+process.cwd()+"/README.md";
  await turn("E6 file scope item", new SendUserCascadeMessageRequest({
    cascadeId:cascade.cascadeId, metadata:md, cascadeConfig:cfg(flash.modelId), blocking:false, clientType:1,
    items:[
      scopeItem(new ContextScopeItem({scopeItem:{case:"file",value:new PathScopeItem({absoluteUri:fileUri})}})),
      textItem("Reply with ONLY the H1 markdown title (the '# ...' on the first heading) of the attached file."),
    ]}));

  // E7: messageOrigin + tags + deliveryStrategy
  await turn("E7 origin/tags/delivery", new SendUserCascadeMessageRequest({
    cascadeId:cascade.cascadeId, metadata:md, cascadeConfig:cfg(flash.modelId), blocking:false, clientType:1,
    items:[textItem("Reply with exactly: A7")], messageOrigin:2 /*SDK_EXECUTABLE*/, tags:["exp","sdk"], deliveryStrategy:1 /*NEXT_INVOCATION*/,
  }));

  process.exit(0);
}
main().catch(e=>{console.error("FATAL",e);process.exit(1);});
