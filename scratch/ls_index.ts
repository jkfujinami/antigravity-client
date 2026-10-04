import { extractDescriptors } from "../scripts/lib/extractor";
type M={name:string;input:string;output:string;cs:boolean;ss:boolean};
function get(bundle:string):M[]{
  const out:M[]=[];
  for(const d of extractDescriptors(bundle))
    for(const s of d.proto.service||[]) if(s.name==="LanguageServerService")
      for(const m of s.method||[]) out.push({name:m.name!,input:(m.inputType||"").replace(/^\./,"").split(".").pop()!,output:(m.outputType||"").replace(/^\./,"").split(".").pop()!,cs:!!m.clientStreaming,ss:!!m.serverStreaming});
  return out;
}
const cur=get("resource/extension_formatted.js");
const old=new Set(get("resource/extension_formatted.old.js").map(m=>m.name));
// functional buckets by keyword
const cats:[string,RegExp][]=[
  ["Cascade / Agent core",/Cascade|Trajectory|Battle|Executor|Planner|Agent|Subagent|Brain|Turn|Step/],
  ["Chat / Messaging",/Message|Chat|Conversation|Prompt|Feedback/],
  ["Model / Inference",/Model|Inference|Predict|Completion|Rerank|Embed/],
  ["Terminal / Command",/Terminal|Command|Shell|Exec|Process/],
  ["Git / VCS / JJ",/Git|Jj|Commit|Repo|Branch|Diff|Checkout|Stage|VersionControl|Fig|Worktree/],
  ["File / Workspace",/File|Directory|Workspace|Folder|Watch|Fs|Path|Blob|Notebook/],
  ["Browser",/Browser|Url|Screenshot|Dom|Navigate/],
  ["Search / Index / Knowledge",/Search|Index|Knowledge|Grep|Find|Retrieve|Context|Embed|Rule/],
  ["Auth / User / License / Admin",/Login|Auth|User|Status|License|Admin|Quota|Credit|Entitlement|Terms|Onboard/],
  ["MCP / Plugins / Tools",/Mcp|Plugin|Tool|Sidecar|Extension|Hook/],
  ["Drive / Cloud / Project",/Drive|Cloud|Project|Upload|Backup|Bundle|Magic|Sync|Gob/],
  ["Config / Settings / Flags",/Config|Setting|Flag|Mendel|Experiment|Option|Preference/],
  ["Telemetry / Debug / Misc",/Telemetry|Analytics|Debug|Log|Record|Health|Ping|Dump|Flight/],
];
const used=new Set<string>();
for(const [label,re] of cats){
  const ms=cur.filter(m=>!used.has(m.name)&&re.test(m.name)).sort((a,b)=>a.name.localeCompare(b.name));
  ms.forEach(m=>used.add(m.name));
  if(!ms.length)continue;
  console.log(`\n## ${label}  (${ms.length})`);
  for(const m of ms){const s=m.ss?"→stream":m.cs?"←cstream":"unary";console.log(`${old.has(m.name)?"  ":"🆕"} ${m.name}  [${s}]`);}
}
const rest=cur.filter(m=>!used.has(m.name)).sort((a,b)=>a.name.localeCompare(b.name));
if(rest.length){console.log(`\n## (uncategorized)  (${rest.length})`);rest.forEach(m=>console.log(`${old.has(m.name)?"  ":"🆕"} ${m.name}`));}
console.log(`\nTOTAL ${cur.length} methods, ${cur.filter(m=>!old.has(m.name)).length} new`);
