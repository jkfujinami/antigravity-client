import { ContextScopeItem } from "../src/gen/exa/codeium_common_pb/codeium_common_pb.js";

const SCALAR:Record<number,string>={1:"double",2:"float",3:"int64",4:"uint64",5:"int32",6:"fixed64",7:"fixed32",8:"bool",9:"string",12:"bytes",13:"uint32",14:"enum",15:"sfixed32",16:"sfixed64",17:"sint32",18:"sint64"};
function typeStr(f:any):string{
  if(f.kind==="scalar")return SCALAR[f.T]||`scalar(${f.T})`;
  if(f.kind==="enum")return `enum ${f.T?.typeName?.split(".").pop()||"?"}`;
  if(f.kind==="message")return f.T?.typeName?.split(".").pop()||"msg";
  if(f.kind==="map")return `map<${SCALAR[f.K]},${f.V?.T?.typeName?.split(".").pop()||SCALAR[f.V?.T]||"?"}>`;
  return f.kind;
}
function dumpFields(MsgClass:any,indent:string,depth:number,seen:Set<string>){
  if(!MsgClass?.fields)return;
  const oneofs=new Map<string,string[]>();
  for(const f of MsgClass.fields.list()){
    const rep=f.repeated?"[]":"";
    const tag=f.oneof?` (oneof ${f.oneof.name})`:"";
    console.log(`${indent}${f.no} ${f.name}: ${typeStr(f)}${rep}${tag}`);
    if(f.kind==="message"&&depth>0){
      const tn=f.T?.typeName;
      if(tn&&!seen.has(tn)){seen.add(tn);dumpFields(f.T,indent+"    ",depth-1,seen);}
      else if(tn) console.log(`${indent}    … (${tn.split(".").pop()}, see above)`);
    }
  }
}
console.log("ContextScopeItem  (oneof scope_item)");
dumpFields(ContextScopeItem,"  ",2,new Set(["exa.codeium_common_pb.ContextScopeItem"]));
