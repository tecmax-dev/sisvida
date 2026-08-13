import json

with open("workflow_updated.json") as f:
    wf = json.load(f)

# Change Validar Evento to a test node
if_node = next(n for n in wf["nodes"] if n["id"] == "node-if")
if_node["parameters"]["jsCode"] = """
try {
    const res = await fetch("https://chat.zapresponde.app/api/v1/accounts/1/contacts", {
        headers: { "api_access_token": "TEST" }
    });
    return { fetch_available: true, status: res.status };
} catch (e) {
    return { fetch_available: false, error: e.message };
}
"""
if_node["type"] = "n8n-nodes-base.code"
if_node["typeVersion"] = 2

with open("workflow_test.json", "w") as f:
    allowed = ["name", "nodes", "connections", "settings", "staticData"]
    json.dump({k: wf[k] for k in allowed if k in wf}, f, indent=2)
