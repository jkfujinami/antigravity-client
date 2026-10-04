import { AntigravityClient } from "../src/index.js";
import { GetCascadeTrajectoryGeneratorMetadataRequest } from "../src/gen/exa/language_server_pb/language_server_pb.js";
async function main(){
  const client=await AntigravityClient.connect();
  const cascade=await client.startCascade();
  console.log("cascadeId:",cascade.cascadeId);
  await cascade.run("Say: PONG",{timeoutMs:30000});
  const resp=await client.lsClient.getCascadeTrajectoryGeneratorMetadata(new GetCascadeTrajectoryGeneratorMetadataRequest({cascadeId:cascade.cascadeId,generatorMetadataOffset:0,includeMessages:true}));
  console.log("generator_metadata entries:",resp.generatorMetadata.length);
  for(const gm of resp.generatorMetadata as any[]){
    const cm=gm.chatModel; if(!cm)continue;
    console.log(`\n--- generator (stepIndices=${gm.stepIndices}) ---`);
    console.log(`  usage input=${cm.usage?.inputTokens} output=${cm.usage?.outputTokens}`);
    console.log(`  system_prompt length: ${cm.systemPrompt?.length||0} chars`);
    console.log(`  prompt_sections (${cm.promptSections?.length||0}):`);
    for(const ps of cm.promptSections||[]) console.log(`     - "${ps.title}" (${(ps.content||ps.templatedContent||"").length} chars, tokenType=${ps.tokenType})`);
  }
  process.exit(0);
}
main().catch(e=>{console.error("FATAL",String(e).slice(0,200));process.exit(1);});
