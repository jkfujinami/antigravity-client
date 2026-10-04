import * as cortex from "../src/gen/exa/cortex_pb/cortex_pb.js";
const S:Record<number,string>={3:"int64",4:"uint64",5:"int32",8:"bool",9:"string",13:"uint32",14:"enum",2:"float"};
const ts=(f:any)=>f.kind==="scalar"?(S[f.T]||`s${f.T}`):f.kind==="enum"?`enum ${f.T?.typeName?.split(".").pop()}`:f.kind==="message"?f.T?.typeName?.split(".").pop():f.kind;
for(const n of ["ComponentResolutionPolicy","NamedItem","CustomAgentSystemPromptConfig"]){
  const C=(cortex as any)[n];console.log(`\n== ${n} ==`);if(!C){console.log(" missing");continue;}
  for(const f of C.fields.list())console.log(`  ${f.no} ${f.name}: ${ts(f)}${f.repeated?"[]":""}`);
}
// enums possibly
for(const k of Object.keys(cortex as any)) if(/ResolutionPolicy|ResolutionMode|ComponentResolution/i.test(k) && typeof (cortex as any)[k]==="object") console.log("enum?",k,JSON.stringify((cortex as any)[k]).slice(0,200));
