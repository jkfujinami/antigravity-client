import { AntigravityClient } from "../src/index.js";
import { StartCascadeRequest, SendUserCascadeMessageRequest, GetCascadeTrajectoryGeneratorMetadataRequest } from "../src/gen/exa/language_server_pb/language_server_pb.js";
import { CascadeConfig, CascadePlannerConfig, DeclarativeMixinConfig, CustomAgentSpec } from "../src/gen/exa/cortex_pb/cortex_pb.js";
import { Metadata, TextOrScopeItem, ModelOrAlias } from "../src/gen/exa/codeium_common_pb/codeium_common_pb.js";
import { Cascade } from "../src/core/cascade/index.js";
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function main(){
  const client:any=await AntigravityClient.connect();
  const models=await client.getAvailableModels();
  const flash=Object.entries(models).find(([k])=>/flash/i.test(k))![1] as any;
  const planner=new CascadePlannerConfig({plannerTypeConfig:{case:"declarativeMixinConfig",value:new DeclarativeMixinConfig({providers:[],promptSections:[],tools:[]})},requestedModel:new ModelOrAlias({choice:{case:"model",value:flash.modelId}})});
  const cfg=new CascadeConfig({plannerConfig:planner});
  const md=new Metadata({apiKey:client.apiKey,ideName:"vscode",ideVersion:"1.107.0",extensionName:"antigravity",extensionVersion:"0.2.0"});
  const {cascadeId}=await client.lsClient.startCascade(new StartCascadeRequest({metadata:md,source:1,customAgentSpec:new CustomAgentSpec({cascadeConfig:cfg} as any)}));
  const cascade=new Cascade(cascadeId,client.lsClient,client.apiKey,(n:any)=>client.resolveModelId(n));cascade.listen();
  let st:string[]=[];cascade.on("statusChange",(e:any)=>st.push(e.status));
  async function turn(n:number){
    st.length=0;
    await client.lsClient.sendUserCascadeMessage(new SendUserCascadeMessageRequest({cascadeId,cascadeConfig:cfg,clientType:1,items:[new TextOrScopeItem({chunk:{case:"text",value:"2+2? one number only"}})]}));
    const t0=Date.now();while(Date.now()-t0<30000){if(st.includes("idle")&&Date.now()-t0>2000)break;await sleep(300);}
    await sleep(1500);
    const r:any=await client.lsClient.getCascadeTrajectoryGeneratorMetadata(new GetCascadeTrajectoryGeneratorMetadataRequest({cascadeId,generatorMetadataOffset:0,includeMessages:true}));
    const gens=r.toJson().generatorMetadata||[];const cm=gens[gens.length-1]?.chatModel;
    console.log(`\n== turn ${n} == tools=${cm?.tools?.length}`);
    (cm?.messagePrompts||[]).forEach((m:any,i:number)=>console.log(`  msg[${i}] ${m.source} numTok=${m.numTokens}\n${(m.prompt||"").split("\n").slice(0,40).join("\n")}`));
  }
  await turn(1);
  process.exit(0);
}
main().catch(e=>{console.error("FATAL",String(e).slice(0,200));process.exit(1);});
