# Teste de consulta NFC-e Focus

A integração consulta somente o status da NFC-e, sem enviar payload de emissão.

- Método: `GET`
- URL: `https://api.focusnfe.com.br/v2/nfce/59b99b5e-0900-4c04-a95f-4bd24514a1dc`
- Autenticação: Basic Auth, com o token no servidor
- Variável exigida: `FOCUS_NFE_TOKEN`
- Timeout: 8 segundos

A referência anterior `.../nfce/ref=...` está incorreta. Este teste não gera uma nota fiscal. Respostas 401/403 indicam credencial ou autorização inválida; 404 indica referência inexistente; falhas de rede e timeout são retornadas separadamente com `correlation_id`.
