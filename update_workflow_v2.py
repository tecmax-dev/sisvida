import json

with open("workflow_updated.json") as f:
    wf = json.load(f)

search_node = next(n for n in wf["nodes"] if n["id"] == "node-search")

# Fix pagination structure
search_node["parameters"]["options"]["pagination"] = {
    "strategy": "page",
    "pageParameter": "page",
    "pageSize": 15
}
# Keep returnAll: True for now, but move it to options if needed?
# Actually in v4 it is at the top level of parameters.
search_node["parameters"]["returnAll"] = True

with open("workflow_final_v4.json", "w") as f:
    json.dump(wf, f, indent=2)
