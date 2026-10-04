import { AntigravityClient } from "../src/index.js";
import { SendUserCascadeMessageRequest, GetCascadeTrajectoryGeneratorMetadataRequest } from "../src/gen/exa/language_server_pb/language_server_pb.js";
import { CascadeConfig, CascadePlannerConfig, CascadeConversationalPlannerConfig, PromptSectionCustomizationConfig, CascadeToolConfig } from "../src/gen/exa/cortex_pb/cortex_pb.js";
import { TextOrScopeItem, ModelOrAlias } from "../src/gen/exa/codeium_common_pb/codeium_common_pb.js";
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const SECTIONS=["identity","user_information","web_application_development","ephemeral_message","customizations","skills","subagents","messaging","conversation_transcript","artifacts","slash_commands","guidelines","communication_style"];
async function main(){
  const client=await AntigravityClient.connect();
  const models=await client.getAvailableModels();
  const flash=Object.entries(models).find(([k])=>/flash/i.test(k))![1] as any;
  const cascade=await client.startCascade();
  const cid=cascade.cascadeId;
  let text="";cascade.on("text",(e:any)=>text+=e.delta);
  function planner(opts:{strip?:boolean,noTools?:boolean,agentic?:boolean}){
    const conv=new CascadeConversationalPlannerConfig({plannerMode:1});
    if(opts.agentic===false)(conv as any).agenticMode=false;
    const p=new CascadePlannerConfig({plannerTypeConfig:{case:"conversational",value:conv},requestedModel:new ModelOrAlias({choice:{case:"model",value:flash.modelId}})});
    if(opts.strip)(p as any).promptSectionCustomizationConfig=new PromptSectionCustomizationConfig({removePromptSections:SECTIONS});
    if(opts.noTools)(p as any).toolConfig=new CascadeToolConfig({forceDisableToolCalling:true});
    return p;
  }
  async function turn(label:string,opts:any){
    text="";let st:string[]=[];const h=(e:any)=>st.push(e.status);cascade.on("statusChange",h);
    let err="";try{await client.lsClient.sendUserCascadeMessage(new SendUserCascadeMessageRequest({cascadeId:cid,cascadeConfig:new CascadeConfig({plannerConfig:planner(opts)}),clientType:1,items:[new TextOrScopeItem({chunk:{case:"text",value:"Say: PONG"}})]}));}catch(e:any){err=String(e.message).slice(0,80);}
    const t0=Date.now();while(Date.now()-t0<35000){if(st.includes("idle")&&Date.now()-t0>2000)break;await sleep(300);}
    cascade.off("statusChange",h);await sleep(2500);
    const r:any=await client.lsClient.getCascadeTrajectoryGeneratorMetadata(new GetCascadeTrajectoryGeneratorMetadataRequest({cascadeId:cid,generatorMetadataOffset:0,includeMessages:true}));
    const gens=r.toJson().generatorMetadata||[]; const cm=gens[gens.length-1]?.chatModel;
    console.log(`${label}: input_tokens=${cm?.usage?.inputTokens} tools=${cm?.tools?.length||0} sysLen=${(cm?.systemPrompt||"").length} err=${err||"none"} text=${JSON.stringify(text.slice(0,30))}`);
  }
  await turn("baseline           ",{});
  await turn("strip              ",{strip:true});
  await turn("strip+noTools      ",{strip:true,noTools:true});
  await turn("strip+noTools+nonAg",{strip:true,noTools:true,agentic:false});
  process.exit(0);
}
main().catch(e=>{console.error("FATAL",String(e).slice(0,200));process.exit(1);});
