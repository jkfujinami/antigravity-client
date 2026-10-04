import { AntigravityClient } from "../../../src/index.js";
import { GetCascadeTrajectoryGeneratorMetadataRequest } from "../../../src/gen/exa/language_server_pb/language_server_pb.js";
import * as fs from "fs";
async function main(){
  const client:any=await AntigravityClient.connect();
  const cascade=await client.startCascade();               // DEFAULT config, no customization
  console.log("cascadeId:",cascade.cascadeId);
  await cascade.run("Say: PONG",{timeoutMs:30000});
  const r:any=await client.lsClient.getCascadeTrajectoryGeneratorMetadata(new GetCascadeTrajectoryGeneratorMetadataRequest({cascadeId:cascade.cascadeId,generatorMetadataOffset:0,includeMessages:true}));
  const gens=r.toJson().generatorMetadata||[];
  // choose the generator with the richest chatModel (largest systemPrompt)
  let best:any=null; for(const g of gens){ const cm=g.chatModel; if(cm && (cm.systemPrompt||"").length > ((best?.systemPrompt)||"").length) best=cm; }
  if(!best){console.log("no chatModel captured, gens=",gens.length);process.exit(1);}
  console.log("systemPrompt chars:",(best.systemPrompt||"").length);
  console.log("sections:",(best.promptSections||[]).length,"tools:",(best.tools||[]).length,"messages:",(best.messagePrompts||[]).length);
  console.log("model:",best.model,"input_tokens:",best.usage?.inputTokens);
  // save raw pieces
  fs.writeFileSync("docs/api/reference/default-system-prompt.txt", best.systemPrompt||"");
  fs.writeFileSync("docs/api/reference/default-chatModel.json", JSON.stringify(best,null,1));
  fs.writeFileSync("docs/api/reference/default-sections.json", JSON.stringify(best.promptSections||[],null,1));
  fs.writeFileSync("docs/api/reference/default-tools.json", JSON.stringify(best.tools||[],null,1));
  fs.writeFileSync("docs/api/reference/default-message-envelope.json", JSON.stringify(best.messagePrompts||[],null,1));
  // section title + sizes
  for(const ps of best.promptSections||[]) console.log(`   section "${ps.title}": ${(ps.content||ps.templatedContent||"").length} chars`);
  for(const t of best.tools||[]) console.log(`   tool "${t.name}": ${JSON.stringify(t).length} B`);
  process.exit(0);
}
main().catch(e=>{console.error("FATAL",String(e).slice(0,200));process.exit(1);});
