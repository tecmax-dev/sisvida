---
name: Biolife exclusivo para titulares
description: Autorizações/Declarações do benefício Biolife não podem ser emitidas para dependentes em /sindicato e no PWA
type: constraint
---
O benefício **Biolife** (qualquer benefício cujo `name`/`partner_name`/`category` contenha "biolife", case-insensitive) é **exclusivo do titular**. Bloquear emissão de autorização/declaração para dependentes em:
- `src/components/union/authorizations/CreateAuthorizationDialog.tsx` (admin /sindicato)
- `src/components/mobile/MobileCreateDeclarationDialog.tsx` (PWA app do associado)

Mostrar alerta claro (toast + banner) e desabilitar botão/card quando dependente estiver selecionado.
**Why:** regra de negócio do parceiro Biolife.
