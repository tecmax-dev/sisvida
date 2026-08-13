import json

with open("workflow_updated.json") as f:
    wf = json.load(f)

search_node = next(n for n in wf["nodes"] if n["id"] == "node-search")
search_node["parameters"]["returnAll"] = True
search_node["parameters"]["options"]["pagination"] = {
    "pagination": {
        "strategy": "page",
        "page": "={{$pageCount + 1}}"
    }
}

id_node = next(n for n in wf["nodes"] if n["id"] == "node-id")
id_node["parameters"]["jsCode"] = """
const input = $input.all();
let allContacts = [];
let pagesAnalyzed = 0;

input.forEach(item => {
    const res = item.json;
    if (Array.isArray(res)) {
        pagesAnalyzed += res.length;
        res.forEach(page => {
            if (page.payload && Array.isArray(page.payload)) {
                allContacts = allContacts.concat(page.payload);
            }
        });
    } else if (res.payload && Array.isArray(res.payload)) {
        pagesAnalyzed += 1;
        allContacts = allContacts.concat(res.payload);
    }
});

const webhookNode = $("Webhook").first().json;
const targetPhone = webhookNode.body.phone.replace(/[^0-9]/g, "");
const targetSuffix8 = targetPhone.slice(-8);

let foundContact = null;
let matchType = "NENHUM";
let ambiguous = false;

for (const contact of allContacts) {
    const chatwootPhone = (contact.phone_number || "").replace(/[^0-9]/g, "");
    if (!chatwootPhone) continue;
    
    if (chatwootPhone === targetPhone) {
        if (foundContact && matchType === "FULL_PHONE" && foundContact.id !== contact.id) { 
            ambiguous = true; break; 
        }
        foundContact = contact;
        matchType = "FULL_PHONE";
    } 
    else if (chatwootPhone.slice(-8) === targetSuffix8) {
        if (foundContact && matchType === "BRAZIL_LEGACY_NUMBER" && foundContact.id !== contact.id) { 
            ambiguous = true; break; 
        }
        if (!foundContact || matchType !== "FULL_PHONE") {
            foundContact = contact;
            matchType = "BRAZIL_LEGACY_NUMBER";
        }
    }
}

return { 
    contact_found: !!foundContact && !ambiguous, 
    ambiguous: ambiguous, 
    match_type: matchType,
    id: foundContact ? foundContact.id : null,
    phone_number: foundContact ? foundContact.phone_number : null,
    pages_analyzed: pagesAnalyzed,
    contacts_analyzed: allContacts.length,
    pagination_complete: true
};
"""

# Re-add node-if (I accidentally changed it to a code node in previous debug step)
if_node = next(n for n in wf["nodes"] if n["id"] == "node-if")
if_node["type"] = "n8n-nodes-base.if"
if_node["typeVersion"] = 1
if_node["parameters"] = {
    "conditions": {
        "string": [
            {
                "value1": "={{ $json.body.event }}",
                "value2": "CARTEIRINHA_ATUALIZACAO_NECESSARIA"
            }
        ]
    }
}

with open("workflow_ready.json", "w") as f:
    allowed = ["name", "nodes", "connections", "settings", "staticData"]
    json.dump({k: wf[k] for k in allowed if k in wf}, f, indent=2)
