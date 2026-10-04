import { AntigravityClient } from "../src/index.js";
import { StartCascadeRequest, SendUserCascadeMessageRequest, GetCascadeTrajectoryGeneratorMetadataRequest } from "../src/gen/exa/language_server_pb/language_server_pb.js";
import { CascadeConfig, CascadePlannerConfig, CascadeConversationalPlannerConfig, PromptSectionCustomizationConfig, CascadeToolConfig, ConversationHistoryConfig, CustomAgentSpec } from "../src/gen/exa/cortex_pb/cortex_pb.js";
import { Metadata, TextOrScopeItem, ModelOrAlias } from "../src/gen/exa/codeium_common_pb/codeium_common_pb.js";
import { Cascade } from "../src/core/cascade/index.js";
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const SECTIONS=["identity","user_information","web_application_development","ephemeral_message","customizations","skills","subagents","messaging","conversation_transcript","artifacts","slash_commands","guidelines","communication_style"];
async function main(){
  const client:any=await AntigravityClient.connect();
  const models=await client.getAvailableModels();
  const flash=Object.entries(models).find(([k])=>/flash/i.test(k))![1] as any;
  const conv=new CascadeConversationalPlannerConfig({plannerMode:1});
  (conv as any).agenticMode=false;(conv as any).conversationHistoryConfig=new ConversationHistoryConfig({enabled:false});
  const planner=new CascadePlannerConfig({plannerTypeConfig:{case:"conversational",value:conv},requestedModel:new ModelOrAlias({choice:{case:"model",value:flash.modelId}})});
  (planner as any).promptSectionCustomizationConfig=new PromptSectionCustomizationConfig({removePromptSections:SECTIONS});
  (planner as any).toolConfig=new CascadeToolConfig({forceDisableToolCalling:true});
  const cfg=new CascadeConfig({plannerConfig:planner});
  const md=new Metadata({apiKey:client.apiKey,ideName:"vscode",ideVersion:"1.107.0",extensionName:"antigravity",extensionVersion:"0.2.0"});
  const spec=new CustomAgentSpec({cascadeConfig:cfg} as any);
  const req=new StartCascadeRequest({metadata:md,source:1,customAgentSpec:spec});
  const {cascadeId}=await client.lsClient.startCascade(req);
  console.log("cascadeId:",cascadeId);
  const cascade=new Cascade(cascadeId,client.lsClient,client.apiKey,(n:any)=>client.resolveModelId(n));
  cascade.listen();
  let text="";cascade.on("text",(e:any)=>text+=e.delta);let st:string[]=[];cascade.on("statusChange",(e:any)=>st.push(e.status));
  // send WITH same cfg per-message too
  await client.lsClient.sendUserCascadeMessage(new SendUserCascadeMessageRequest({cascadeId,cascadeConfig:cfg,clientType:1,items:[new TextOrScopeItem({chunk:{case:"text",value:"Say: PONG"}})]}));
  const t0=Date.now();while(Date.now()-t0<30000){if(st.includes("idle")&&Date.now()-t0>2000)break;await sleep(300);}
  await sleep(2000);
  const r:any=await client.lsClient.getCascadeTrajectoryGeneratorMetadata(new GetCascadeTrajectoryGeneratorMetadataRequest({cascadeId,generatorMetadataOffset:0,includeMessages:true}));
  const gens=r.toJson().generatorMetadata||[];const cm=gens[gens.length-1]?.chatModel;
  console.log("input_tokens:",cm?.usage?.inputTokens,"tools:",cm?.tools?.length,"msgTokens:",(cm?.messagePrompts||[]).map((m:any)=>m.numTokens),"text:",JSON.stringify(text.slice(0,20)));
  process.exit(0);
}
main().catch(e=>{console.error("FATAL",String(e).slice(0,200));process.exit(1);});
