import * as cortex from "../src/gen/exa/cortex_pb/cortex_pb.js";
const S:Record<number,string>={3:"int64",4:"uint64",5:"int32",8:"bool",9:"string",12:"bytes",13:"uint32",14:"enum",2:"float"};
const ts=(f:any)=>f.kind==="scalar"?(S[f.T]||`s${f.T}`):f.kind==="enum"?`enum ${f.T?.typeName?.split(".").pop()}`:f.kind==="message"?f.T?.typeName?.split(".").pop():f.kind==="map"?`map`:f.kind;
for(const n of ["ConversationHistoryConfig","SdkCustomizationConfig","MessageConfig","ContextConfig"]){
  const C=(cortex as any)[n]; console.log(`\n===== ${n} =====`); if(!C){console.log("  (missing)");continue;}
  for(const f of C.fields.list())console.log(`  ${f.no} ${f.name}: ${ts(f)}${f.repeated?"[]":""}`);
}
