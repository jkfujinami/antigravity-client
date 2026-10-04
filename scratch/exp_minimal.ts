import { AntigravityClient } from "../src/index.js";
import { SendUserCascadeMessageRequest, GetCascadeTrajectoryGeneratorMetadataRequest } from "../src/gen/exa/language_server_pb/language_server_pb.js";
import { CascadeConfig, CascadePlannerConfig, CascadeConversationalPlannerConfig, PromptSectionCustomizationConfig, CascadeToolConfig, ConversationHistoryConfig } from "../src/gen/exa/cortex_pb/cortex_pb.js";
import { TextOrScopeItem, ModelOrAlias } from "../src/gen/exa/codeium_common_pb/codeium_common_pb.js";
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const SECTIONS=["identity","user_information","web_application_development","ephemeral_message","customizations","skills","subagents","messaging","conversation_transcript","artifacts","slash_commands","guidelines","communication_style"];
async function main(){
  const client=await AntigravityClient.connect();
  const models=await client.getAvailableModels();
  const flash=Object.entries(models).find(([k])=>/flash/i.test(k))![1] as any;
  async function tryCase(planCase:string){
    const cascade=await client.startCascade();const cid=cascade.cascadeId;
    let text="";cascade.on("text",(e:any)=>text+=e.delta);let st:string[]=[];cascade.on("statusChange",(e:any)=>st.push(e.status));
    const conv=new CascadeConversationalPlannerConfig({plannerMode:1});(conv as any).agenticMode=false;(conv as any).conversationHistoryConfig=new ConversationHistoryConfig({enabled:false});
    const p=new CascadePlannerConfig({plannerTypeConfig:{case:planCase as any,value:conv},requestedModel:new ModelOrAlias({choice:{case:"model",value:flash.modelId}})});
    (p as any).promptSectionCustomizationConfig=new PromptSectionCustomizationConfig({removePromptSections:SECTIONS});
    (p as any).toolConfig=new CascadeToolConfig({forceDisableToolCalling:true});
    let err="";
    try{await client.lsClient.sendUserCascadeMessage(new SendUserCascadeMessageRequest({cascadeId:cid,cascadeConfig:new CascadeConfig({plannerConfig:p}),clientType:1,items:[new TextOrScopeItem({chunk:{case:"text",value:"Say: PONG"}})]}));}catch(e:any){err=String(e.message).slice(0,90);}
    const t0=Date.now();while(Date.now()-t0<30000){if(st.includes("idle")&&Date.now()-t0>2000)break;await sleep(300);}
    await sleep(1800);
    let inTok:any="?",tools:any="?",msgs:any="?";
    try{const r:any=await client.lsClient.getCascadeTrajectoryGeneratorMetadata(new GetCascadeTrajectoryGeneratorMetadataRequest({cascadeId:cid,generatorMetadataOffset:0,includeMessages:true}));const gens=r.toJson().generatorMetadata||[];const cm=gens[gens.length-1]?.chatModel;inTok=cm?.usage?.inputTokens;tools=cm?.tools?.length;msgs=(cm?.messagePrompts||[]).map((m:any)=>m.numTokens);}catch{}
    console.log(`planner="${planCase}": input_tokens=${inTok} tools=${tools} msgTokens=[${msgs}] err=${err||"none"} text=${JSON.stringify(text.slice(0,20))}`);
  }
  for(const c of ["conversational","googleMinimal","google","cider"]) await tryCase(c);
  process.exit(0);
}
main().catch(e=>{console.error("FATAL",String(e).slice(0,200));process.exit(1);});
