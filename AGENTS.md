
- Portal value entry (employer/accounting_office) requires a valid, unused worker-list validation (validate-worker-list → contribution_worker_list_validations) enforced in set-contribution-value; why: backend must not trust the frontend gate.

- Signature links must be issued for a patient in the caller’s authorized clinic; official WhatsApp sends use the approved UTILITY URL template with a 24-hour single-use token and server-side consent, opt-out and audit gates.
- Affiliation welcome sends run only through send-affiliation-welcome after approval, with Meta-approved UTILITY template, clinic authorization, consent and a unique audit attempt per affiliation; why: prevent unauthorized or duplicate proactive sends.
