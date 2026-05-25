---
name: Biolife exclusivo para titulares
description: Biolife — exclusivo do titular E limitado a 1 autorização a cada 12 meses por titular
type: constraint
---
O benefício **Biolife** (qualquer benefício cujo `name`/`partner_name`/`category` contenha "biolife", case-insensitive) é **exclusivo do titular**. Bloquear emissão de autorização/declaração para dependentes em:
- `src/components/union/authorizations/CreateAuthorizationDialog.tsx` (admin /sindicato)
- `src/components/mobile/MobileCreateDeclarationDialog.tsx` (PWA app do associado)

Mostrar alerta claro (toast + banner) e desabilitar botão/card quando dependente estiver selecionado.

**Cooldown de 12 meses:** o titular só pode emitir **1 autorização Biolife a cada 12 meses**. A checagem busca a última autorização Biolife (qualquer status exceto `revoked`) e calcula `issued_at + 1 ano`. Se ainda futuro, bloquear nova emissão (toast + banner + card desabilitado) e informar a data de próxima emissão disponível.

**Why:** regra de negócio do parceiro Biolife.
