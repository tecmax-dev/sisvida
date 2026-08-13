---
name: Biolife — dois tipos de autorização
description: Biolife — titular (feminino) = cobertura 100% pelo sindicato; dependente = desconto de 50% do laboratório (restante pago no ato pelo dependente); 1 emissão/12 meses por beneficiário
type: constraint
---
O benefício **Biolife** (qualquer benefício cujo `name`/`partner_name`/`category` contenha "biolife") tem **dois tipos distintos de autorização**:

1. **Titular** → *Cobertura integral (100%) pelo sindicato*. Somente associadas do **sexo feminino** (`patients.gender` = `f`/`fem...`). O laboratório fatura ao sindicato; nada é cobrado da associada.
2. **Dependente** → *Desconto de 50% concedido pelo próprio laboratório; os 50% restantes são pagos no ato pelo dependente no laboratório*. **O sindicato NÃO custeia**. O laboratório não deve faturar ao sindicato; cobra os 50% restantes do dependente no ato.

**Cooldown:** 1 autorização a cada 12 meses **por beneficiário** (titular e cada dependente contam separadamente).

Textos e helpers centralizados em `src/lib/biolifeAuthorization.ts` (`isBiolifeBenefit`, `getBiolifeAuthorizationInfo`), exibidos em:
- `src/pages/AuthorizationValidationPage.tsx` (página pública lida pelo laboratório)
- `src/components/union/authorizations/AuthorizationViewDialog.tsx` (impressão/painel)
- `src/pages/mobile/MobileAuthorizationsPage.tsx` (PWA)
Emissão: `CreateAuthorizationDialog.tsx` (painel) e `MobileCreateDeclarationDialog.tsx` (PWA).
Regras no banco: trigger `enforce_biolife_authorization_rules`.

**Why:** regra de negócio do parceiro Biolife — dependente não tem custeio sindical.
