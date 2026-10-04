import { AntigravityClient } from "../src/index.js";
import { StartCascadeRequest, SendUserCascadeMessageRequest, GetCascadeTrajectoryGeneratorMetadataRequest } from "../src/gen/exa/language_server_pb/language_server_pb.js";
import { CascadeConfig, CascadePlannerConfig, CustomAgentConfig, CustomAgentSpec, DeclarativeMixinConfig, CustomizationDiscoveryConfig, CustomizationConfig } from "../src/gen/exa/cortex_pb/cortex_pb.js";
import { Metadata, TextOrScopeItem, ModelOrAlias } from "../src/gen/exa/codeium_common_pb/codeium_common_pb.js";
import { Cascade } from "../src/core/cascade/index.js";
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function run(label:string, mkPlanner:(m:number)=>CascadePlannerConfig){
  const client:any=await AntigravityClient.connect();
  const models=await client.getAvailableModels();
  const flash=Object.entries(models).find(([k])=>/flash/i.test(k))![1] as any;
  const planner=mkPlanner(flash.modelId);
  const cfg=new CascadeConfig({plannerConfig:planner});
  const md=new Metadata({apiKey:client.apiKey,ideName:"vscode",ideVersion:"1.107.0",extensionName:"antigravity",extensionVersion:"0.2.0"});
  let cascadeId="",err="";
  try{({cascadeId}=await client.lsClient.startCascade(new StartCascadeRequest({metadata:md,source:1,customAgentSpec:new CustomAgentSpec({cascadeConfig:cfg} as any)})));}catch(e:any){console.log(`${label}: START err ${String(e.message).slice(0,90)}`);return;}
  const cascade=new Cascade(cascadeId,client.lsClient,client.apiKey,(n:any)=>client.resolveModelId(n));cascade.listen();
  let text="";cascade.on("text",(e:any)=>text+=e.delta);let st:string[]=[];cascade.on("statusChange",(e:any)=>st.push(e.status));
  try{await client.lsClient.sendUserCascadeMessage(new SendUserCascadeMessageRequest({cascadeId,cascadeConfig:cfg,clientType:1,items:[new TextOrScopeItem({chunk:{case:"text",value:"Say: PONG"}})]}));}catch(e:any){err=String(e.message).slice(0,90);}
  const t0=Date.now();while(Date.now()-t0<30000){if(st.includes("idle")&&Date.now()-t0>2000)break;await sleep(300);}
  await sleep(1800);
  let inTok:any="?",tools:any="?";
  try{const r:any=await client.lsClient.getCascadeTrajectoryGeneratorMetadata(new GetCascadeTrajectoryGeneratorMetadataRequest({cascadeId,generatorMetadataOffset:0,includeMessages:true}));const gens=r.toJson().generatorMetadata||[];const cm=gens[gens.length-1]?.chatModel;inTok=cm?.usage?.inputTokens;tools=(cm?.tools||[]).map((t:any)=>t.name);}catch{}
  console.log(`${label}: input_tokens=${inTok} tools=${JSON.stringify(tools)} err=${err||"none"} text=${JSON.stringify(text.slice(0,20))}`);
}
async function main(){
  // A: declarative empty
  await run("declarative-empty",(m)=>new CascadePlannerConfig({plannerTypeConfig:{case:"declarativeMixinConfig",value:new DeclarativeMixinConfig({providers:[],promptSections:[],tools:[]})},requestedModel:new ModelOrAlias({choice:{case:"model",value:m}})}));
  // B: customAgent + discovery disabled (no plugins/skills/mcp -> maybe drops 'schedule')
  await run("customAgent+noDiscovery",(m)=>{
    const p=new CascadePlannerConfig({plannerTypeConfig:{case:"customAgent",value:new CustomAgentConfig({systemPromptSections:[],toolNames:[]})},requestedModel:new ModelOrAlias({choice:{case:"model",value:m}})});
    (p as any).customizationConfig=new CustomizationConfig({toolNames:[],customizationDiscoveryConfig:new CustomizationDiscoveryConfig({})});
    return p;
  });
  process.exit(0);
}
main().catch(e=>{console.error("FATAL",String(e).slice(0,200));process.exit(1);});
