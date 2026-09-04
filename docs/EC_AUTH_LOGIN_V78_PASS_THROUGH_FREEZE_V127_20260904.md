# Freeze V127 — passagem exata do login existente pelo guard V78

Data: 2026-09-04
País e operação: Vitalismen Ecuador
Baseline pai: V125, commit `475ab887656bbb8865f3c16e42bec0d63e9421a6`, tree `9cc5f631db2d2cf1925d82703478cdda18921386`

## Causa raiz confirmada

O `POST /api/auth/login` era interceptado pelo middleware global V78 antes de alcançar o roteador de autenticação existente. Como a rota não fazia parte das mutações operacionais autorizadas, o guard respondia `423 ec_bot_core_v78_operation_blocked`. A conta, o hash de senha e a emissão de JWT não chegavam a ser consultados.

## Microcamada V127

Somente o método `POST` no caminho exato `/api/auth/login` atravessa o bloqueio HTTP V78. Prefixos, sufixos, barra final, outros métodos e todas as demais rotas de autenticação continuam sujeitos ao bloqueio anterior.

O contexto desta passagem mantém `writeContext: false`. A única mutação Mongo adicional permitida é `users.updateOne`, exclusivamente dentro do contexto exato do login, para preservar o `lastLoginAt` já gravado pela implementação existente. Inserts, deletes, outras coleções e efeitos externos permanecem bloqueados.

## Preservado byte a byte

- `src/routes/auth.js`: comparação de senha, JWT, expiração, respostas e atualização de login;
- `src/middleware/auth.js`: validação do token e proteção de sessão;
- `src/index.js`: ordem do rate limiter, guard V78 e roteador de autenticação;
- `public/qr.html`: formulário e cliente do painel;
- `src/services/ecBotCoreOperationalV78Service.js`: perfil operacional congelado.

## Escopo preservado

- VSL, funil, bot, Z-API, inbound e salvamento de clientes;
- V125 e camadas V122–V124 do painel;
- Dropi, V114, V116, V118, Meta/CAPI e pós-venda;
- PM2, Mongo, nginx, health, produtos, preços e banco sem migração ou backfill;
- release V126 inativo, sem reativação ou alteração.

## Publicação

Esta camada é candidata local/staging. Produção permanece na V125 até aprovação humana explícita `APROVADO AUTH PARA PUBLICAR`.

## Rollback

Retornar ao release V125:

`/opt/vitalismen-automacao/releases/20260904T051254Z_production-20260904-475ab88`
