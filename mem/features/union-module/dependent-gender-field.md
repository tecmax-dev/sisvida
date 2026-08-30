---
name: Sexo do dependente
description: Campo gender em patient_dependents usado na regra de profissional exclusiva para mulheres (Karen Freire)
type: feature
---
`public.patient_dependents.gender` ('masculino' | 'feminino' | 'outro', opcional) é a fonte primária do sexo do dependente.

- Cadastro: `DependentsPanel.tsx` (painel) e `DependentInclusionForm.tsx` (PWA, obrigatório, enviado via `request_dependent_inclusion(p_gender)`).
- Regra Karen Freire (atendimento exclusivo feminino): trigger `check_professional_gender_restriction` usa `gender` primeiro; sem gender, usa heurística de parentesco (PT e EN); se indeterminado, bloqueia pedindo o preenchimento do sexo.
- No app, `isDependentMale()` em `MobileBookingPage.tsx` segue a mesma ordem (gender → parentesco).
- Backfill inicial feito por CPF do paciente correspondente e por parentesco.
