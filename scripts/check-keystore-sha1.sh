#!/usr/bin/env bash
# ----------------------------------------------------------------------------
# check-keystore-sha1.sh
#
# Verifica se uma keystore Android contém o certificado com o SHA1 esperado
# pelo Google Play Console para o app br.com.prosindweb.twa.
#
# Uso:
#   ./scripts/check-keystore-sha1.sh <caminho-da-keystore> [alias]
#
# Exemplos:
#   ./scripts/check-keystore-sha1.sh ./signing.keystore
#   ./scripts/check-keystore-sha1.sh ~/Downloads/android.keystore my-key-alias
#
# Requisitos: Java instalado (keytool no PATH).
# ----------------------------------------------------------------------------
set -euo pipefail

EXPECTED_SHA1="98:15:F2:94:CC:88:B9:4A:83:93:45:AB:DC:15:84:5A:D3:D8:A4:79"

RED="\033[0;31m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
BLUE="\033[0;34m"
BOLD="\033[1m"
NC="\033[0m"

if [[ $# -lt 1 ]]; then
  echo -e "${RED}Erro:${NC} informe o caminho da keystore."
  echo "Uso: $0 <caminho-da-keystore> [alias]"
  exit 1
fi

KEYSTORE="$1"
ALIAS="${2:-}"

if [[ ! -f "$KEYSTORE" ]]; then
  echo -e "${RED}Erro:${NC} arquivo não encontrado: $KEYSTORE"
  exit 1
fi

if ! command -v keytool >/dev/null 2>&1; then
  echo -e "${RED}Erro:${NC} 'keytool' não encontrado. Instale o JDK (ex: brew install openjdk)."
  exit 1
fi

echo -e "${BOLD}${BLUE}Keystore:${NC} $KEYSTORE"
echo -e "${BOLD}${BLUE}SHA1 esperado:${NC} $EXPECTED_SHA1"
echo ""
echo -e "${YELLOW}Digite a senha da keystore quando solicitado.${NC}"
echo ""

if [[ -n "$ALIAS" ]]; then
  OUTPUT="$(keytool -list -v -keystore "$KEYSTORE" -alias "$ALIAS" 2>/dev/null || true)"
else
  OUTPUT="$(keytool -list -v -keystore "$KEYSTORE" 2>/dev/null || true)"
fi

if [[ -z "$OUTPUT" ]]; then
  echo -e "${RED}Erro:${NC} não foi possível ler a keystore. Senha incorreta ou alias inválido?"
  exit 1
fi

# Extrai todas as linhas de SHA1 (pode haver múltiplos aliases)
FOUND_SHA1S=$(echo "$OUTPUT" | grep -E "^\s*SHA1:" | sed -E 's/^\s*SHA1:\s*//I' | tr -d ' ')
EXPECTED_NORMALIZED=$(echo "$EXPECTED_SHA1" | tr -d ' ' | tr '[:lower:]' '[:upper:]')

if [[ -z "$FOUND_SHA1S" ]]; then
  echo -e "${RED}❌ Nenhum SHA1 encontrado na keystore.${NC}"
  exit 1
fi

echo -e "${BOLD}SHA1(s) encontrados na keystore:${NC}"
echo "$FOUND_SHA1S" | sed 's/^/  - /'
echo ""

MATCH=0
while IFS= read -r sha; do
  NORMALIZED=$(echo "$sha" | tr '[:lower:]' '[:upper:]')
  if [[ "$NORMALIZED" == "$EXPECTED_NORMALIZED" ]]; then
    MATCH=1
    break
  fi
done <<< "$FOUND_SHA1S"

if [[ $MATCH -eq 1 ]]; then
  echo -e "${GREEN}${BOLD}✅ MATCH! Esta é a keystore correta.${NC}"
  echo -e "${GREEN}Pode usá-la no PWABuilder (opção 'Use mine') para gerar o .aab.${NC}"
  exit 0
else
  echo -e "${RED}${BOLD}❌ Não bate. Esta keystore NÃO produz o SHA1 exigido pelo Google Play.${NC}"
  echo -e "${YELLOW}Procure outra keystore (ZIP original do PWABuilder) ou solicite reset da chave de upload no Play Console.${NC}"
  exit 2
fi