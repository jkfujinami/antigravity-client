import { extractDescriptors } from "../scripts/lib/extractor";
type EM = Map<string,{no:number,name:string}[]>;
function enums(bundle:string):EM{
  const m:EM=new Map();
  const walk=(msgs:any[],pkg:string)=>{
    for(const e of msgs){ // enums passed separately
    }
  };
  for(const d of extractDescriptors(bundle)){
    const pkg=d.proto.package||"";
    const collect=(ens:any[],prefix:string)=>{for(const en of ens)m.set(`${prefix}.${en.name}`,en.value.map((v:any)=>({no:v.number,name:v.name})));};
    collect(d.proto.enumType,pkg);
    const rec=(msgs:any[],prefix:string)=>{for(const msg of msgs){const p=`${prefix}.${msg.name}`;collect(msg.enumType||[],p);rec(msg.nestedType||[],p);}};
    rec(d.proto.messageType,pkg);
  }
  return m;
}
const O=enums("resource/extension_formatted.js");
const N=enums("/Applications/Antigravity IDE.app/Contents/Resources/app/extensions/antigravity/dist/extension.js");
for(const [name,nv] of N){
  const ov=O.get(name); if(!ov)continue;
  const oNos=new Set(ov.map(v=>v.no)), nNos=new Set(nv.map(v=>v.no));
  const addedV=nv.filter(v=>!oNos.has(v.no)), removedV=ov.filter(v=>!nNos.has(v.no));
  if(addedV.length||removedV.length){
    console.log(`\n${name}`);
    if(addedV.length)console.log("  + "+addedV.map(v=>`${v.name}(${v.no})`).join(", "));
    if(removedV.length)console.log("  - "+removedV.map(v=>`${v.name}(${v.no})`).join(", "));
  }
}
