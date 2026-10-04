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
const cats:[string,RegExp][]=[
  ["Cascade / Agent core",/Cascade|Trajectory|Battle|Executor|Planner|Agent|Subagent|Brain|Turn|Step/],
  ["Chat / Messaging",/Message|Chat|Conversation|Prompt|Feedback/],
  ["Model / Inference",/Model|Inference|Predict|Completion|Rerank|Embed/],
  ["Terminal / Command",/Terminal|Command|Shell|Exec|Process/],
  ["Git / VCS / JJ",/Git|Jj|Commit|Repo|Branch|Diff|Checkout|Stage|VersionControl|Fig|Worktree/],
  ["File / Workspace",/File|Directory|Workspace|Folder|Watch|Fs|Path|Blob|Notebook|Dir|Uri|Stat/],
  ["Browser",/Browser|Url|Screenshot|Dom|Navigate/],
  ["Search / Index / Knowledge",/Search|Index|Knowledge|Grep|Find|Retrieve|Context|Rule|Scope/],
  ["Auth / User / License / Admin",/Login|Auth|User|Status|License|Admin|Quota|Credit|Entitlement|Terms|Onboard|Gdm|Scope|Team/],
  ["MCP / Plugins / Tools / Sidecar",/Mcp|Plugin|Tool|Sidecar|Extension|Hook/],
  ["Drive / Cloud / Project",/Drive|Cloud|Project|Upload|Backup|Bundle|Magic|Sync|Gob|Environment/],
  ["Config / Settings / Flags",/Config|Setting|Flag|Mendel|Experiment|Option|Preference|Unleash/],
  ["Skills / Workflows / Customization",/Skill|Workflow|Customization|Changelog/],
  ["Audio / Media / Recording",/Audio|Transcription|Media|Screen|Record|Artifact/],
  ["Jetbox / State",/Jetbox|State/],
  ["Telemetry / Debug / Lifecycle",/Telemetry|Analytics|Debug|Log|Health|Ping|Dump|Flight|Pprof|Error|Lint|Heartbeat|Restart|Exit|SegFault|Observability|Diagnostic/],
];
const used=new Set<string>();
const line=(m:M)=>{const isNew=!old.has(m.name);const s=m.ss?(m.cs?"⇄ bidi":"→ server-stream"):(m.cs?"← client-stream":"unary");return `| ${isNew?"🆕":""} | \`${m.name}\` | ${s} | \`${m.input}\` → \`${m.output}\` |`;};
let body="";
for(const [label,re] of cats){
  const ms=cur.filter(m=>!used.has(m.name)&&re.test(m.name)).sort((a,b)=>a.name.localeCompare(b.name));
  ms.forEach(m=>used.add(m.name));
  if(!ms.length)continue;
  body+=`\n### ${label} (${ms.length})\n\n| New | Method | Kind | I/O |\n|:-:|---|---|---|\n${ms.map(line).join("\n")}\n`;
}
const rest=cur.filter(m=>!used.has(m.name)).sort((a,b)=>a.name.localeCompare(b.name));
if(rest.length) body+=`\n### Other (${rest.length})\n\n| New | Method | Kind | I/O |\n|:-:|---|---|---|\n${rest.map(line).join("\n")}\n`;
import * as fs from "fs";
fs.writeFileSync("scratch/index_body.md",body);
console.log("wrote scratch/index_body.md",body.length,"chars; total",cur.length,"new",cur.filter(m=>!old.has(m.name)).length);
