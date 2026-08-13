# MATRIZ DE CONSENTIMENTO WHATSAPP META (PROSINGE)

## 1. CATEGORIZAÇÃO DE MENSAGENS

| Finalidade | Categoria Meta | Exige Opt-in Prévio? | Base Legal (LGPD/Compliance) |
| :--- | :--- | :--- | :--- |
| Atualização de Carteirinha | UTILITY | SIM (conforme gate atual) | Relacionamento Operacional / Consentimento |
| Lembrete de Agendamento | UTILITY | NÃO (Transacional) | Execução de Contrato |
| Recuperação de Senha | AUTHENTICATION | NÃO (Solicitado) | Segurança / Execução de Contrato |
| Novas Vantagens / Convênios | MARKETING | SIM | Consentimento |

## 2. ESTADOS DE CONSENTIMENTO

- **OPT_IN:** Consentimento explícito registrado com prova técnica.
- **OPT_OUT:** Revogação explícita. Bloqueio absoluto.
- **UNKNOWN:** Estado inicial. Bloqueado pelo gate operacional "fail-closed".
- **NOT_REQUIRED:** Apenas para fluxos transacionais solicitados pelo usuário (ex: 2FA).

## 3. REGRA OPERACIONAL DO GATE

Atualmente, o sistema bloqueia qualquer envio em estado `UNKNOWN` para a categoria `UTILITY` (carteirinhas), exigindo regularização da base ou ação afirmativa do usuário.
