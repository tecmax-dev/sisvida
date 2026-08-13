import json
import sys

with open("workflow_updated.json") as f:
    wf = json.load(f)

# Keep only the allowed properties for the n8n API PUT request
allowed_keys = ["name", "nodes", "connections", "settings", "staticData", "meta", "active", "tags"]
clean_wf = {k: wf[k] for k in allowed_keys if k in wf}

print(json.dumps(clean_wf))
