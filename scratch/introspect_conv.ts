import { CascadeConversationalPlannerConfig } from "../src/gen/exa/cortex_pb/cortex_pb.js";
const S:Record<number,string>={3:"int64",4:"uint64",5:"int32",8:"bool",9:"string",13:"uint32",14:"enum",2:"float"};
const ts=(f:any)=>f.kind==="scalar"?(S[f.T]||`s${f.T}`):f.kind==="enum"?`enum ${f.T?.typeName?.split(".").pop()}`:f.kind==="message"?f.T?.typeName?.split(".").pop():f.kind;
for(const f of (CascadeConversationalPlannerConfig as any).fields.list())console.log(`  ${f.no} ${f.name}: ${ts(f)}${f.repeated?"[]":""}`);
