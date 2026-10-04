import { AntigravityClient } from "../src/index.js";
import { SendUserCascadeMessageRequest, GetCascadeTrajectoryGeneratorMetadataRequest } from "../src/gen/exa/language_server_pb/language_server_pb.js";
import { CascadeConfig, CascadePlannerConfig, CascadeConversationalPlannerConfig, PromptSectionCustomizationConfig, CascadeToolConfig } from "../src/gen/exa/cortex_pb/cortex_pb.js";
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
  const conv=new CascadeConversationalPlannerConfig({plannerMode:1}); (conv as any).agenticMode=false;
  const p=new CascadePlannerConfig({plannerTypeConfig:{case:"conversational",value:conv},requestedModel:new ModelOrAlias({choice:{case:"model",value:flash.modelId}})});
  (p as any).promptSectionCustomizationConfig=new PromptSectionCustomizationConfig({removePromptSections:SECTIONS});
  (p as any).toolConfig=new CascadeToolConfig({forceDisableToolCalling:true});
  let st:string[]=[];cascade.on("statusChange",(e:any)=>st.push(e.status));
  await client.lsClient.sendUserCascadeMessage(new SendUserCascadeMessageRequest({cascadeId:cid,cascadeConfig:new CascadeConfig({plannerConfig:p}),clientType:1,items:[new TextOrScopeItem({chunk:{case:"text",value:"Say: PONG"}})]}));
  const t0=Date.now();while(Date.now()-t0<35000){if(st.includes("idle")&&Date.now()-t0>2000)break;await sleep(300);}
  await sleep(2000);
  const r:any=await client.lsClient.getCascadeTrajectoryGeneratorMetadata(new GetCascadeTrajectoryGeneratorMetadataRequest({cascadeId:cid,generatorMetadataOffset:0,includeMessages:true}));
  const gens=r.toJson().generatorMetadata||[]; const cm=gens[gens.length-1]?.chatModel;
  console.log("input_tokens:",cm?.usage?.inputTokens,"tools:",cm?.tools?.length,"sysLen:",(cm?.systemPrompt||"").length);
  fs.writeFileSync("scratch/msg2150.json",JSON.stringify(cm?.messagePrompts||[],null,1));
  (cm?.messagePrompts||[]).forEach((m:any,i:number)=>{
    const s=JSON.stringify(m);
    console.log(`\n--- msg[${i}] (${s.length} bytes) keys=${Object.keys(m)} ---`);
    console.log(s.slice(0,700));
  });
  process.exit(0);
}
main().catch(e=>{console.error("FATAL",String(e).slice(0,200));process.exit(1);});
