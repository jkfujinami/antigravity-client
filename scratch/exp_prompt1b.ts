import { AntigravityClient } from "../src/index.js";
import { GetCascadeTrajectoryGeneratorMetadataRequest } from "../src/gen/exa/language_server_pb/language_server_pb.js";
async function main(){
  const client=await AntigravityClient.connect();
  const cascade=await client.startCascade();
  await cascade.run("Say: PONG",{timeoutMs:30000});
  const resp=await client.lsClient.getCascadeTrajectoryGeneratorMetadata(new GetCascadeTrajectoryGeneratorMetadataRequest({cascadeId:cascade.cascadeId,generatorMetadataOffset:0,includeMessages:true}));
  for(const gm of resp.generatorMetadata as any[]){
    const j=gm.toJson?.()??gm;
    console.log("top keys:",Object.keys(j));
    console.log("chatModel keys:",gm.chatModel?Object.keys(gm.chatModel.toJson?.()??{}):"(null)");
    // dump sizes
    const cm=gm.chatModel;
    if(cm){console.log("systemPrompt len",cm.systemPrompt?.length,"sections",cm.promptSections?.length,"messagePrompts",cm.messagePrompts?.length);}
    console.log("promptDebugStr len:", gm.promptDebugStr?.length);
  }
  process.exit(0);
}
main().catch(e=>{console.error("FATAL",String(e).slice(0,200));process.exit(1);});
