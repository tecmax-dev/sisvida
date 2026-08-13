import json

with open("workflow_updated.json") as f:
    wf = json.load(f)

search_node = next(n for n in wf["nodes"] if n["id"] == "node-search")

# New guess for pagination structure in v4.2
search_node["parameters"].pop("options", None)
search_node["parameters"]["sendPagination"] = True
search_node["parameters"]["paginationParameters"] = {
    "strategy": "page",
    "pageParameterName": "page",
    "pageSize": 15
}
search_node["parameters"]["returnAll"] = True

with open("workflow_ready.json", "w") as f:
    # Clean and write
    allowed = ["name", "nodes", "connections", "settings", "staticData"]
    json.dump({k: wf[k] for k in allowed if k in wf}, f, indent=2)
