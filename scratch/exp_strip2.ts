import { AntigravityClient } from "../src/index.js";
import { SendUserCascadeMessageRequest, GetCascadeTrajectoryGeneratorMetadataRequest } from "../src/gen/exa/language_server_pb/language_server_pb.js";
import { CascadeConfig, CascadePlannerConfig, CascadeConversationalPlannerConfig, PromptSectionCustomizationConfig } from "../src/gen/exa/cortex_pb/cortex_pb.js";
import { TextOrScopeItem, ModelOrAlias } from "../src/gen/exa/codeium_common_pb/codeium_common_pb.js";
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const SECTIONS=["identity","user_information","web_application_development","ephemeral_message","customizations","skills","subagents","messaging","conversation_transcript","artifacts","slash_commands","guidelines","communication_style"];
function cfg(id:number,strip:boolean){
  const planner=new CascadePlannerConfig({plannerTypeConfig:{case:"conversational",value:new CascadeConversationalPlannerConfig({plannerMode:1})},requestedModel:new ModelOrAlias({choice:{case:"model",value:id}})});
  if(strip)(planner as any).promptSectionCustomizationConfig=new PromptSectionCustomizationConfig({removePromptSections:SECTIONS});
  return new CascadeConfig({plannerConfig:planner});
}
async function readGen(client:any,cid:string){
  const resp=await client.lsClient.getCascadeTrajectoryGeneratorMetadata(new GetCascadeTrajectoryGeneratorMetadataRequest({cascadeId:cid,generatorMetadataOffset:0,includeMessages:true}));
  const j:any=(resp as any).toJson();
  return (j.generatorMetadata||[]).map((gm:any)=>({sys:(gm.chatModel?.systemPrompt||"").length, in:gm.chatModel?.usage?.inputTokens, out:gm.chatModel?.usage?.outputTokens, sections:(gm.chatModel?.promptSections||[]).map((p:any)=>p.title)}));
}
async function main(){
  const client=await AntigravityClient.connect();
  const models=await client.getAvailableModels();
  const flash=Object.entries(models).find(([k])=>/flash/i.test(k))![1] as any;
  const cascade=await client.startCascade();
  const cid=cascade.cascadeId; console.log("cascadeId:",cid);
  let text="";cascade.on("text",(e:any)=>text+=e.delta);
  const item=(t:string)=>new TextOrScopeItem({chunk:{case:"text",value:t}});
  async function turn(strip:boolean){
    text="";let statuses:string[]=[];const h=(e:any)=>statuses.push(e.status);cascade.on("statusChange",h);
    let err="";
    try{await client.lsClient.sendUserCascadeMessage(new SendUserCascadeMessageRequest({cascadeId:cid,cascadeConfig:cfg(flash.modelId,strip),clientType:1,items:[item("Reply with exactly: PONG")]}));}catch(e:any){err=String(e.message).slice(0,100);}
    const t0=Date.now();while(Date.now()-t0<35000){if(statuses.includes("idle")&&Date.now()-t0>2000)break;await sleep(300);}
    cascade.off("statusChange",h);
    console.log(`  [strip=${strip}] err=${err||"none"} text=${JSON.stringify(text.slice(0,40))}`);
    await sleep(2500);
  }
  console.log("--- BASELINE ---");await turn(false);
  console.log("--- STRIPPED ---");await turn(true);
  const gens=await readGen(client,cid);
  console.log(`\ngenerator entries: ${gens.length}`);
  gens.forEach((g:any,i:number)=>console.log(`  gen[${i}] systemPrompt=${g.sys} chars  input_tokens=${g.in} output=${g.out}\n           sections(${g.sections.length})=[${g.sections.join(",")}]`));
  process.exit(0);
}
main().catch(e=>{console.error("FATAL",String(e).slice(0,220));process.exit(1);});
