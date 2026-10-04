import { GetModelResponseRequest, GetModelResponseResponse } from "../src/gen/exa/language_server_pb/language_server_pb.js";
const S:Record<number,string>={3:"int64",4:"uint64",5:"int32",8:"bool",9:"string",12:"bytes",13:"uint32",14:"enum"};
const ts=(f:any)=>f.kind==="scalar"?(S[f.T]||`s${f.T}`):f.kind==="enum"?`enum ${f.T?.typeName?.split(".").pop()}`:f.kind==="message"?f.T?.typeName?.split(".").pop():f.kind;
for(const [n,C] of [["REQ",GetModelResponseRequest],["RESP",GetModelResponseResponse]] as any){console.log(`--- ${n} ---`);for(const f of C.fields.list())console.log(`  ${f.no} ${f.name}: ${ts(f)}${f.repeated?"[]":""}`);}
