import { AntigravityClient } from "../src/index.js";
import { GetCascadeTrajectoryGeneratorMetadataRequest } from "../src/gen/exa/language_server_pb/language_server_pb.js";
import * as fs from "fs";
async function main(){
  const client=await AntigravityClient.connect();
  const cascade=await client.startCascade();
  await cascade.run("Say: PONG",{timeoutMs:30000});
  for(const inc of [true,false]){
    const resp=await client.lsClient.getCascadeTrajectoryGeneratorMetadata(new GetCascadeTrajectoryGeneratorMetadataRequest({cascadeId:cascade.cascadeId,generatorMetadataOffset:0,includeMessages:inc}));
    const j=(resp as any).toJson?.()??resp;
    fs.writeFileSync(`scratch/gm_dump_inc${inc}.json`, JSON.stringify(j,null,1));
    console.log(`include_messages=${inc}: bytes=${JSON.stringify(j).length}, entries=${resp.generatorMetadata.length}`);
  }
  process.exit(0);
}
main().catch(e=>{console.error("FATAL",String(e).slice(0,200));process.exit(1);});
