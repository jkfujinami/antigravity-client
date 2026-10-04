import { AntigravityClient } from "../src/index.js";
import { StartCascadeRequest, SendUserCascadeMessageRequest, GetCascadeTrajectoryGeneratorMetadataRequest } from "../src/gen/exa/language_server_pb/language_server_pb.js";
import { CascadeConfig, CascadePlannerConfig, CustomAgentConfig, CustomAgentSpec } from "../src/gen/exa/cortex_pb/cortex_pb.js";
import { Metadata, TextOrScopeItem, ModelOrAlias } from "../src/gen/exa/codeium_common_pb/codeium_common_pb.js";
import { Cascade } from "../src/core/cascade/index.js";
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function main(){
  const client:any=await AntigravityClient.connect();
  const models=await client.getAvailableModels();
  const flash=Object.entries(models).find(([k])=>/flash/i.test(k))![1] as any;
  // EMPTY custom agent: no system prompt sections, no tools
  const agent=new CustomAgentConfig({systemPromptSections:[],toolNames:[]});
  const planner=new CascadePlannerConfig({plannerTypeConfig:{case:"customAgent",value:agent},requestedModel:new ModelOrAlias({choice:{case:"model",value:flash.modelId}})});
  const cfg=new CascadeConfig({plannerConfig:planner});
  const md=new Metadata({apiKey:client.apiKey,ideName:"vscode",ideVersion:"1.107.0",extensionName:"antigravity",extensionVersion:"0.2.0"});
  const req=new StartCascadeRequest({metadata:md,source:1,customAgentSpec:new CustomAgentSpec({cascadeConfig:cfg} as any)});
  const {cascadeId}=await client.lsClient.startCascade(req);
  console.log("cascadeId:",cascadeId);
  const cascade=new Cascade(cascadeId,client.lsClient,client.apiKey,(n:any)=>client.resolveModelId(n));cascade.listen();
  let text="";cascade.on("text",(e:any)=>text+=e.delta);let st:string[]=[];cascade.on("statusChange",(e:any)=>st.push(e.status));
  let err="";
  try{await client.lsClient.sendUserCascadeMessage(new SendUserCascadeMessageRequest({cascadeId,cascadeConfig:cfg,clientType:1,items:[new TextOrScopeItem({chunk:{case:"text",value:"Say: PONG"}})]}));}catch(e:any){err=String(e.message).slice(0,120);}
  const t0=Date.now();while(Date.now()-t0<30000){if(st.includes("idle")&&Date.now()-t0>2000)break;await sleep(300);}
  await sleep(2000);
  const r:any=await client.lsClient.getCascadeTrajectoryGeneratorMetadata(new GetCascadeTrajectoryGeneratorMetadataRequest({cascadeId,generatorMetadataOffset:0,includeMessages:true}));
  const gens=r.toJson().generatorMetadata||[];const cm=gens[gens.length-1]?.chatModel;
  console.log("err:",err||"none","text:",JSON.stringify(text.slice(0,30)));
  console.log("input_tokens:",cm?.usage?.inputTokens,"tools:",cm?.tools?.length,"sysLen:",(cm?.systemPrompt||"").length);
  (cm?.messagePrompts||[]).forEach((m:any,i:number)=>console.log(`  msg[${i}] ${m.source} numTokens=${m.numTokens} :: ${JSON.stringify((m.prompt||"").slice(0,120))}`));
  process.exit(0);
}
main().catch(e=>{console.error("FATAL",String(e).slice(0,200));process.exit(1);});
