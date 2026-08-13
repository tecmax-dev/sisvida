import json

with open("workflow_updated.json") as f:
    wf = json.load(f)

id_node = next(n for n in wf["nodes"] if n["id"] == "node-id")
id_node["parameters"]["jsCode"] = """
const results = $node["Chatwoot Search"].json;
return { 
    contact_found: false, 
    debug_results: results,
    reason_code: "DEBUG_RESULTS"
};
"""

with open("workflow_debug.json", "w") as f:
    allowed = ["name", "nodes", "connections", "settings", "staticData"]
    json.dump({k: wf[k] for k in allowed if k in wf}, f, indent=2)
