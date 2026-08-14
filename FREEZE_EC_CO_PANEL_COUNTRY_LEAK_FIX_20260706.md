# Freeze EC/CO Panel Country Leak Fix - 2026-07-06

## Escopo

- Projeto ativo: Equador Maxlien, com painel compartilhado temporariamente EC/CO.
- Problema reportado: mensagem de cliente pedindo Nitrix/oxido nitrico apareceu no painel/filtro Colombia.
- Risco: contaminacao operacional de atendimento entre EC e CO durante trafego pago.

## Diagnostico

- Z-API ativo em producao: conectado no final `2800`.
- Configuracao ativa do VPS:
  - `WHATSAPP_DEFAULT_SESSION_ID`: final `2800`.
  - `WHATSAPP_SELLER_POOL_EC`: final `2800`.
  - `WHATSAPP_SELLER_POOL_CO`: vazio no `.env` ativo.
- Codigo/documentacao mantinham `8416` como numero/sessao CO, mas ele nao esta ativo no `.env` do VPS.
- Visitas recentes da campanha Nitrix/NX chegaram em `https://ec.maxlien.shop/n/`, pais `EC`, com seller final `2800`.
- A frase literal `Me puede decir si tiene oxido nitric` nao foi encontrada no Mongo principal nem nos logs do processo, mas o bug de filtro foi confirmado.

## Causa Encontrada

O filtro do endpoint `/api/whatsapp/chats?country=CO` aceitava qualquer conversa com:

- `metadata.zapiCapturedContact=true`.

Isso funcionava como passe livre entre paises. Um contato capturado por Z-API podia aparecer no filtro CO mesmo tendo telefone/pais EC ou outro.

## Correcao Aplicada

Arquivo:

- `src/routes/whatsapp.js`.

Mudancas:

- Removido `metadata.zapiCapturedContact=true` do `scopedContactQuery` por pais.
- Removido `metadata.zapiCapturedContact=true` dos contatos fixados do painel EC.
- Removido bypass `c.zapiCapturedContact || isAllowedPanelPhoneForCountry(...)` nos filtros fast e normal.
- Agora o contato entra no painel do pais apenas se:
  - `countryCode` do contato bater com o filtro; ou
  - telefone for permitido pelo DDI do pais; ou
  - for numero operacional/teste explicitamente permitido.

Guarda adicionada:

- `scripts/audit-no-regression-meta-country.mjs` bloqueia retorno do passe livre de `zapiCapturedContact`.

## Publicacao

- Backup VPS: `/root/codex_deploy_backups/ec-co-panel-country-leak-20260706T023309Z`.
- PM2: `vitalismen-automation` online apos restart.
- Release ativa: `/opt/vitalismen-automacao/releases/202606141310`.

Hashes publicados:

- `src/routes/whatsapp.js`: `d12abdf2fea5f861b0afc48b347c0c2aac66f55f054fa5fedff3139053798a84`.
- `scripts/audit-no-regression-meta-country.mjs`: `eece555f24677ce4517e67f0abb631ed90c861807e279d906d20f576ee993dfa`.

## Validacao

- `node --check src/routes/whatsapp.js`: OK.
- `node --check scripts/audit-no-regression-meta-country.mjs`: OK.
- Guardas no VPS:
  - `scripts/guard-freeze-lock-ec.mjs`: OK.
  - `scripts/guard-status-panels-freeze.mjs`: OK.
  - `scripts/audit-no-regression-meta-country.mjs`: OK.
  - `scripts/audit-customer-draft-zero-quantity.mjs`: OK.
- `https://ec.maxlien.shop/api/health/`: `status=online`, `engine=Z-API`.
- `https://ec.maxlien.shop/api/zapi/status`: conectado, smartphone conectado, final `2800`.

## Evidencia Do Vazamento Corrigido

Consulta Mongo apos deploy:

- `zapiCapturedContact` recentes: `4`.
- Pela regra antiga, `4` poderiam aparecer em CO sem serem CO.
- Pela regra nova, ficam bloqueados no filtro CO porque nao passam por DDI/pais CO.

Distribuicao recente:

- `saved:EC/phone:EC`: 2.
- `saved:BR/phone:BR`: 1.
- `saved:OTHER/phone:OTHER`: 1.

## Regra Operacional

- Equador/Nitrix deve operar no final `2800` enquanto o VPS estiver com Z-API atual.
- Colombia so deve aparecer para clientes DDI `57` ou para numero/sessao CO explicitamente configurado.
- Se CO for realmente operar no final `8416`, ainda falta configurar isso no `.env` ativo do VPS; hoje ele existe em documentacao/exemplo, mas nao como pool CO ativo.
