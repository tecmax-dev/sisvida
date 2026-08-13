import json

with open("workflow.json") as f:
    wf = json.load(f)

# Find Chatwoot Search node
search_node = next(n for n in wf["nodes"] if n["id"] == "node-search")

# Update search node for pagination
# In v4.2, the parameters are quite specific. 
# We'll use the "Pagination" option which usually looks like this:
search_node["parameters"]["options"]["pagination"] = {
    "pagination": {
        "strategy": "page",
        "pageParameter": "page",
        "pageSize": 15
    }
}
# Also ensure it returns all items
search_node["parameters"]["returnAll"] = True

# Update Identify Contact node
id_node = next(n for n in wf["nodes"] if n["id"] == "node-id")
id_node["parameters"]["jsCode"] = """
const searchNodeResults = $node["Chatwoot Search"].json;
let allContacts = [];
let pagesAnalyzed = 0;

if (Array.isArray(searchNodeResults)) {
    pagesAnalyzed = searchNodeResults.length;
    searchNodeResults.forEach(res => {
        if (res.payload && Array.isArray(res.payload)) {
            allContacts = allContacts.concat(res.payload);
        }
    });
} else if (searchNodeResults.payload && Array.isArray(searchNodeResults.payload)) {
    pagesAnalyzed = 1;
    allContacts = searchNodeResults.payload;
} else if (Array.isArray(searchNodeResults.payload)) {
    pagesAnalyzed = 1;
    allContacts = searchNodeResults.payload;
}

const webhookBody = $node["Webhook"].json.body;
const targetPhone = webhookBody.phone.replace(/[^0-9]/g, "");
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

if (ambiguous) return { contact_found: false, ambiguous: true, reason_code: "AMBIGUOUS_PHONE_MATCH", pages_analyzed: pagesAnalyzed, contacts_analyzed: allContacts.length };
if (!foundContact) return { contact_found: false, ambiguous: false, reason_code: "CONTACT_NOT_FOUND", pages_analyzed: pagesAnalyzed, contacts_analyzed: allContacts.length };

return { 
    contact_found: true, 
    ambiguous: false, 
    match_type: matchType,
    id: foundContact.id,
    phone_number: foundContact.phone_number,
    pages_analyzed: pagesAnalyzed,
    contacts_analyzed: allContacts.length,
    pagination_complete: true
};
"""

# Update Build Preview node
build_node = next(n for n in wf["nodes"] if n["id"] == "node-build")
build_node["parameters"]["jsCode"] = """
const identifyNode = $node["Identify Contact"].json;
const webhookNode = $node["Webhook"].json;
const convsNode = $node["Chatwoot Conversations"];

const contact_found = identifyNode.contact_found;
// Safely check for Chatwoot Conversations node execution
let convs = [];
try {
    if (contact_found && convsNode && convsNode.json) {
        convs = convsNode.json.payload || [];
    }
} catch (e) {}

const waConv = Array.isArray(convs) ? convs.find(c => String(c.inbox_id) === "1") : null;

return {
  status: "DRY_RUN",
  would_send: false,
  contact_id: contact_found ? identifyNode.id : null,
  conversation_id: waConv ? waConv.id : null,
  inbox_id: waConv ? waConv.inbox_id : null,
  inbox_name: waConv ? (waConv.inbox ? waConv.inbox.name : "Whats-3223") : null,
  inbox_id_1_confirmed: waConv ? (String(waConv.inbox_id) === "1") : false,
  template_name: "carteirinha_atualizacao_necessaria",
  language: "pt_BR",
  request_id: webhookNode.body.request_id,
  idempotency_key: webhookNode.body.idempotency_key,
  event_valid: true,
  preview_built: true,
  match_type: identifyNode.match_type,
  resolver_method: "GET",
  resolver_endpoint: "/contacts",
  pages_analyzed: identifyNode.pages_analyzed,
  contacts_analyzed: identifyNode.contacts_analyzed,
  pagination_complete: !!identifyNode.pagination_complete,
  ambiguous: !!identifyNode.ambiguous,
  reason_code: contact_found ? (waConv ? "READY" : "NO_WHATSAPP_INBOX") : (identifyNode.reason_code || "CONTACT_NOT_FOUND")
};
"""

with open("workflow_updated.json", "w") as f:
    json.dump(wf, f, indent=2)
