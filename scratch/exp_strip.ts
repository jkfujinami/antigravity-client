import { AntigravityClient } from "../src/index.js";
import { SendUserCascadeMessageRequest, GetCascadeTrajectoryGeneratorMetadataRequest } from "../src/gen/exa/language_server_pb/language_server_pb.js";
import { CascadeConfig, CascadePlannerConfig, CascadeConversationalPlannerConfig, PromptSectionCustomizationConfig } from "../src/gen/exa/cortex_pb/cortex_pb.js";
import { TextOrScopeItem, ModelOrAlias } from "../src/gen/exa/codeium_common_pb/codeium_common_pb.js";
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const SECTIONS=["identity","user_information","web_application_development","ephemeral_message","customizations","skills","subagents","messaging","conversation_transcript","artifacts","slash_commands","guidelines","communication_style"];
function cfg(id:number, strip:boolean){
  const planner=new CascadePlannerConfig({
    plannerTypeConfig:{case:"conversational",value:new CascadeConversationalPlannerConfig({plannerMode:1})},
    requestedModel:new ModelOrAlias({choice:{case:"model",value:id}}),
  });
  if(strip) (planner as any).promptSectionCustomizationConfig=new PromptSectionCustomizationConfig({removePromptSections:SECTIONS});
  return new CascadeConfig({plannerConfig:planner});
}
async function readGen(client:any,cid:string){
  const resp=await client.lsClient.getCascadeTrajectoryGeneratorMetadata(new GetCascadeTrajectoryGeneratorMetadataRequest({cascadeId:cid,generatorMetadataOffset:0,includeMessages:true}));
  return (resp.generatorMetadata as any[]).map(gm=>({sys:gm.chatModel?.systemPrompt?.length||0, in:gm.chatModel?.usage?.inputTokens, sections:(gm.chatModel?.promptSections||[]).map((p:any)=>p.title)}));
}
async function main(){
  const client=await AntigravityClient.connect();
  const models=await client.getAvailableModels();
  const flash=Object.entries(models).find(([k])=>/flash/i.test(k))![1] as any;
  const cascade=await client.startCascade();
  const cid=cascade.cascadeId; console.log("cascadeId:",cid,"model:",flash.modelId);
  const item=(t:string)=>new TextOrScopeItem({chunk:{case:"text",value:t}});
  async function turn(strip:boolean){
    let statuses:string[]=[];const h=(e:any)=>statuses.push(e.status);cascade.on("statusChange",h);
    await client.lsClient.sendUserCascadeMessage(new SendUserCascadeMessageRequest({cascadeId:cid,cascadeConfig:cfg(flash.modelId,strip),clientType:1,items:[item("Reply with exactly: PONG")]}));
    const t0=Date.now();while(Date.now()-t0<30000){if(statuses.includes("idle")&&Date.now()-t0>1500)break;await sleep(300);}
    cascade.off("statusChange",h);
  }
  console.log("\n--- BASELINE turn ---"); await turn(false); await sleep(1500);
  console.log("--- STRIPPED turn ---"); await turn(true); await sleep(1500);
  const gens=await readGen(client,cid);
  console.log(`\ngenerator entries: ${gens.length}`);
  gens.forEach((g,i)=>console.log(`  gen[${i}] systemPrompt=${g.sys} chars, input_tokens=${g.in}, sections=[${g.sections.join(",")}]`));
  process.exit(0);
}
main().catch(e=>{console.error("FATAL",String(e).slice(0,220));process.exit(1);});
