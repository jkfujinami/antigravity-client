import { extractDescriptors } from "../scripts/lib/extractor";
type M = { service:string; name:string; input:string; output:string; clientStream:boolean; serverStream:boolean };
function methods(bundle:string):M[]{
  const out:M[]=[];
  for(const d of extractDescriptors(bundle)){
    const pkg=d.proto.package||"";
    for(const s of d.proto.service||[]){
      for(const m of s.method||[]){
        out.push({service:`${pkg}.${s.name}`,name:m.name!,
          input:(m.inputType||"").replace(/^\./,""),output:(m.outputType||"").replace(/^\./,""),
          clientStream:!!m.clientStreaming,serverStream:!!m.serverStreaming});
      }
    }
  }
  return out;
}
const NEW=methods("resource/extension_formatted.js");
const OLD=new Set(methods("resource/extension_formatted.old.js").map(m=>`${m.service}#${m.name}`));
const byService:Record<string,M[]>={};
for(const m of NEW){(byService[m.service]??=[]).push(m);}
let total=0,newCount=0;
for(const svc of Object.keys(byService).sort()){
  const ms=byService[svc];total+=ms.length;
  console.log(`\n### ${svc}  (${ms.length})`);
  for(const m of ms.sort((a,b)=>a.name.localeCompare(b.name))){
    const isNew=!OLD.has(`${m.service}#${m.name}`); if(isNew)newCount++;
    const stream=m.serverStream?(m.clientStream?"⇄bidi":"→stream"):(m.clientStream?"←cstream":"unary");
    console.log(`${isNew?"🆕":"  "} ${m.name} [${stream}]  ${m.input.split(".").pop()} → ${m.output.split(".").pop()}`);
  }
}
console.log(`\n=== TOTAL: ${total} methods across ${Object.keys(byService).length} services, ${newCount} NEW ===`);
