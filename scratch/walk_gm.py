import json
d=json.load(open("scratch/gm_dump_inctrue.json"))
KEYS={"systemPrompt","promptSections","messagePrompts","promptDebugStr"}
def walk(o,path=""):
    if isinstance(o,dict):
        for k,v in o.items():
            if k in KEYS:
                if isinstance(v,str): print(f"{path}.{k}: str len={len(v)}")
                elif isinstance(v,list):
                    titles=[x.get("title") for x in v if isinstance(x,dict)]
                    print(f"{path}.{k}: list[{len(v)}] titles={titles[:25]}")
            walk(v,path+"."+k)
    elif isinstance(o,list):
        for i,x in enumerate(o): walk(x,path+f"[{i}]")
walk(d)
