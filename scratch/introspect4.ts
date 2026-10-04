import { CortexStepGeneratorMetadata } from "../src/gen/exa/cortex_pb/cortex_pb.js";
const S:Record<number,string>={3:"int64",4:"uint64",5:"int32",8:"bool",9:"string",13:"uint32",14:"enum",2:"float"};
function ts(f:any){if(f.kind==="scalar")return S[f.T]||`s${f.T}`;if(f.kind==="enum")return `enum ${f.T?.typeName?.split(".").pop()}`;if(f.kind==="message")return f.T?.typeName?.split(".").pop();return f.kind;}
for(const f of (CortexStepGeneratorMetadata as any).fields.list())console.log(`  ${f.no} ${f.name}: ${ts(f)}${f.repeated?"[]":""}`);
