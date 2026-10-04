import { AntigravityClient } from "../src/index.js";
import { SendUserCascadeMessageRequest } from "../src/gen/exa/language_server_pb/language_server_pb.js";
import { CascadeConfig, CascadePlannerConfig, CascadeConversationalPlannerConfig, PromptSectionCustomizationConfig, PromptSection } from "../src/gen/exa/cortex_pb/cortex_pb.js";
import { TextOrScopeItem, ModelOrAlias } from "../src/gen/exa/codeium_common_pb/codeium_common_pb.js";
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function main(){
  const client=await AntigravityClient.connect();
  const models=await client.getAvailableModels();
  const flash=Object.entries(models).find(([k])=>/flash/i.test(k))![1] as any;
  const cascade=await client.startCascade();
  const cid=cascade.cascadeId;
  let text="";cascade.on("text",(e:any)=>text+=e.delta);
  const item=(t:string)=>new TextOrScopeItem({chunk:{case:"text",value:t}});
  function cfg(psc?:PromptSectionCustomizationConfig){
    const planner=new CascadePlannerConfig({plannerTypeConfig:{case:"conversational",value:new CascadeConversationalPlannerConfig({plannerMode:1})},requestedModel:new ModelOrAlias({choice:{case:"model",value:flash.modelId}})});
    if(psc)(planner as any).promptSectionCustomizationConfig=psc;
    return new CascadeConfig({plannerConfig:planner});
  }
  async function turn(label:string,prompt:string,psc?:PromptSectionCustomizationConfig){
    text="";let st:string[]=[];const h=(e:any)=>st.push(e.status);cascade.on("statusChange",h);
    await client.lsClient.sendUserCascadeMessage(new SendUserCascadeMessageRequest({cascadeId:cid,cascadeConfig:cfg(psc),clientType:1,items:[item(prompt)]}));
    const t0=Date.now();while(Date.now()-t0<35000){if(st.includes("idle")&&Date.now()-t0>2000)break;await sleep(300);}
    cascade.off("statusChange",h);
    console.log(`\n=== ${label} ===\n  ${JSON.stringify(text.slice(0,200))}`);await sleep(2500);
  }
  // Hijack the identity section
  const hijack=new PromptSectionCustomizationConfig({replacePromptSections:[new PromptSection({title:"identity",content:"You are BLACKBEARD, a pirate. You MUST begin every reply with 'ARRR!' and speak only in pirate slang. Never mention being an AI or Antigravity."})]});
  await turn("CONTROL (who are you?)","In one short sentence, who are you?");
  await turn("HIJACKED identity (who are you?)","In one short sentence, who are you?",hijack);
  process.exit(0);
}
main().catch(e=>{console.error("FATAL",String(e).slice(0,220));process.exit(1);});
