
#!/bin/bash

# Script de push seguro para Git
# Verifica status, faz commit e push

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Iniciando push para repositório...${NC}"

# Verificar se é um repositório git
if [ ! -d .git ]; then
  echo -e "${RED}❌ Erro: Não é um repositório Git${NC}"
  exit 1
fi

# Verificar status
if [ -z "$(git status --porcelain)" ]; then
  echo -e "${YELLOW}⚠️  Não há alterações para fazer commit${NC}"
  exit 0
fi

# Obter branch atual
BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo -e "${YELLOW}📍 Branch atual: ${BRANCH}${NC}"

# Adicionar alterações
echo -e "${YELLOW}📝 Adicionando alterações...${NC}"
git add .

# Criar commit com mensagem
COMMIT_MSG="${1:-'Atualização automática do projeto'}"
echo -e "${YELLOW}💾 Criando commit: ${COMMIT_MSG}${NC}"
git commit -m "${COMMIT_MSG}"

# Fazer push
echo -e "${YELLOW}🌐 Enviando para ${BRANCH}...${NC}"
if git push origin "${BRANCH}"; then
  echo -e "${GREEN}✅ Push realizado com sucesso!${NC}"
else
  echo -e "${RED}❌ Erro ao fazer push${NC}"
  exit 1
fi

echo -e "${GREEN}✨ Operação concluída!${NC}"
