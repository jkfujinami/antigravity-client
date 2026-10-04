import * as ls from "../src/gen/exa/language_server_pb/language_server_pb.js";
const S:Record<number,string>={3:"int64",4:"uint64",5:"int32",8:"bool",9:"string",12:"bytes",13:"uint32",14:"enum",2:"float",1:"double"};
const ts=(f:any)=>f.kind==="scalar"?(S[f.T]||`s${f.T}`):f.kind==="enum"?`enum ${f.T?.typeName?.split(".").pop()}`:f.kind==="message"?f.T?.typeName?.split(".").pop():f.kind==="map"?"map":f.kind;
function dump(C:any,ind:string,depth:number,seen:Set<string>){if(!C?.fields)return;for(const f of C.fields.list()){console.log(`${ind}${f.no} ${f.name}: ${ts(f)}${f.repeated?"[]":""}${f.oneof?` (of ${f.oneof.name})`:""}`);if(f.kind==="message"&&depth>0){const tn=f.T?.typeName;if(tn&&!seen.has(tn)){seen.add(tn);dump(f.T,ind+"    ",depth-1,seen);}else if(tn)console.log(`${ind}    … ${tn.split(".").pop()}`);}}}
for(const n of ["StartAudioTranscriptionRequest","StreamAudioTranscriptionResponse","SendAudioChunkRequest","SendAudioChunkResponse","EndAudioSessionRequest","GetTranscriptionRequest","GetTranscriptionResponse"]){
  const C=(ls as any)[n];console.log(`\n===== ${n} =====`);if(!C){console.log(" missing");continue;}dump(C,"  ",1,new Set());
}
