import * as cortex from "../src/gen/exa/cortex_pb/cortex_pb.js";
const S:Record<number,string>={3:"int64",4:"uint64",5:"int32",8:"bool",9:"string",12:"bytes",13:"uint32",14:"enum",2:"float"};
function ts(f:any){if(f.kind==="scalar")return S[f.T]||`s${f.T}`;if(f.kind==="enum")return `enum ${f.T?.typeName?.split(".").pop()}`;if(f.kind==="message")return f.T?.typeName?.split(".").pop();if(f.kind==="map")return `map<${S[f.K]},${f.V?.T?.typeName?.split(".").pop()||S[f.V?.T]}>`;return f.kind;}
function dump(C:any,ind:string,depth:number,seen:Set<string>){if(!C?.fields)return;for(const f of C.fields.list()){console.log(`${ind}${f.no} ${f.name}: ${ts(f)}${f.repeated?"[]":""}${f.oneof?` (of ${f.oneof.name})`:""}`);if(f.kind==="message"&&depth>0){const tn=f.T?.typeName;if(tn&&!seen.has(tn)){seen.add(tn);dump(f.T,ind+"    ",depth-1,seen);}else if(tn)console.log(`${ind}    … ${tn.split(".").pop()}`);}}}
for(const n of ["PromptSectionCustomizationConfig","PromptSection","CascadePlannerConfig","CascadeConversationalPlannerConfig"]){
  const C=(cortex as any)[n]; console.log(`\n===== ${n} =====`); if(!C){console.log("  (not found)");continue;} dump(C,"  ",1,new Set());
}
