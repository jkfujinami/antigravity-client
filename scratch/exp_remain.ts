import { AntigravityClient } from "../src/index.js";
import { SendUserCascadeMessageRequest, GetCascadeTrajectoryGeneratorMetadataRequest } from "../src/gen/exa/language_server_pb/language_server_pb.js";
import { CascadeConfig, CascadePlannerConfig, CascadeConversationalPlannerConfig, PromptSectionCustomizationConfig } from "../src/gen/exa/cortex_pb/cortex_pb.js";
import { TextOrScopeItem, ModelOrAlias } from "../src/gen/exa/codeium_common_pb/codeium_common_pb.js";
import * as fs from "fs";
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const SECTIONS=["identity","user_information","web_application_development","ephemeral_message","customizations","skills","subagents","messaging","conversation_transcript","artifacts","slash_commands","guidelines","communication_style"];
async function main(){
  const client=await AntigravityClient.connect();
  const models=await client.getAvailableModels();
  const flash=Object.entries(models).find(([k])=>/flash/i.test(k))![1] as any;
  const cascade=await client.startCascade();
  const cid=cascade.cascadeId;
  const planner=new CascadePlannerConfig({plannerTypeConfig:{case:"conversational",value:new CascadeConversationalPlannerConfig({plannerMode:1})},requestedModel:new ModelOrAlias({choice:{case:"model",value:flash.modelId}})});
  (planner as any).promptSectionCustomizationConfig=new PromptSectionCustomizationConfig({removePromptSections:SECTIONS});
  let st:string[]=[];cascade.on("statusChange",(e:any)=>st.push(e.status));
  await client.lsClient.sendUserCascadeMessage(new SendUserCascadeMessageRequest({cascadeId:cid,cascadeConfig:new CascadeConfig({plannerConfig:planner}),clientType:1,items:[new TextOrScopeItem({chunk:{case:"text",value:"Say: PONG"}})]}));
  const t0=Date.now();while(Date.now()-t0<35000){if(st.includes("idle")&&Date.now()-t0>2000)break;await sleep(300);}
  await sleep(2000);
  const r:any=await client.lsClient.getCascadeTrajectoryGeneratorMetadata(new GetCascadeTrajectoryGeneratorMetadataRequest({cascadeId:cid,generatorMetadataOffset:0,includeMessages:true}));
  const j=r.toJson();
  const cm=j.generatorMetadata?.[j.generatorMetadata.length-1]?.chatModel;
  console.log("input_tokens:",cm?.usage?.inputTokens);
  console.log("systemPrompt len:",(cm?.systemPrompt||"").length);
  console.log("messagePrompts:",cm?.messagePrompts?.length, "tools:",cm?.tools?.length);
  fs.writeFileSync("scratch/stripped_system_prompt.txt", cm?.systemPrompt||"(empty)");
  fs.writeFileSync("scratch/stripped_full.json", JSON.stringify(cm,null,1));
  // tool sizes
  if(cm?.tools){let tl=0;for(const t of cm.tools)tl+=JSON.stringify(t).length;console.log("tools total json bytes:",tl);}
  if(cm?.messagePrompts){cm.messagePrompts.forEach((m:any,i:number)=>console.log(`  msg[${i}] role=${m.role||m.author||"?"} len=${JSON.stringify(m).length}`));}
  process.exit(0);
}
main().catch(e=>{console.error("FATAL",String(e).slice(0,200));process.exit(1);});
