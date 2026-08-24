# Freeze V59 — saneamento da cadeia Baileys/libsignal/protobufjs

Data: 2026-08-24
Pais: Equador
Pai: `panel-tex-ultra-bottle-block-v58-20260824`

## Incidente comprovado

O `npm audit --omit=dev` da release V58 identificava duas vulnerabilidades
altas e uma critica. A cadeia afetada era exclusivamente indireta:
`@whiskeysockets/baileys@6.7.24` instalava o commit antigo do `libsignal`, que
fixava `protobufjs@6.8.8`. O projeto ja possuia `protobufjs@7.6.5` no topo, mas
a versao antiga permanecia aninhada e era a origem dos tres alertas.

O Baileys `6.7.24` ja contem a correcao da vulnerabilidade direta publicada
como GHSA-qvv5-jq5g-4cgg. A versao 7 disponivel no momento desta microcamada e
release candidate e traz mudancas de migracao; ela nao foi adotada.

## Correcao autorizada

- O Baileys permanece exatamente em `6.7.24` no lockfile.
- O `package.json` substitui somente a dependencia indireta `libsignal` pela
  release oficial `v6.0.0`, resolvida no lock para o commit imutavel
  `bcea72df9ec34d9d9140ab30619cf479c7c144c7`.
- O `libsignal@6.0.0` declara `protobufjs@^7.5.5` e deduplica para a versao
  congelada `7.6.5`; `protobufjs@6.8.8` deixa de existir na arvore.
- A comparacao Git oficial entre o commit anterior e `v6.0.0` mostra mudancas
  de metadados, CI e dependencia. A comparacao local de `index.js` e `src/`
  confirmou zero alteracao no codigo de execucao do `libsignal`.

Referencias oficiais consultadas:

- `https://github.com/WhiskeySockets/Baileys/security/advisories/GHSA-qvv5-jq5g-4cgg`
- `https://github.com/WhiskeySockets/Baileys/releases`
- `https://github.com/WhiskeySockets/libsignal-node/releases/tag/v6.0.0`
- `https://github.com/WhiskeySockets/libsignal-node/compare/1c30d7d7e76a3b0aa120b04dc6a26f5a12dccf67...bcea72df9ec34d9d9140ab30619cf479c7c144c7`

## Travas

- O guard V59 exige as versoes e o commit exatos no lockfile.
- A cadeia antiga, o SHA anterior e `protobufjs@6.8.8` sao proibidos.
- `npm audit --omit=dev --audit-level=moderate` faz parte do guard e deve
  encerrar com zero vulnerabilidades.
- O teste carrega o Baileys e o `libsignal` sem abrir socket, criar sessao ou
  enviar mensagem.
- O lockfile passa a integrar o congelamento sucessor e qualquer atualizacao
  posterior exige microcamada explicita.

## Preservado

Z-API continua sendo o transporte oficial. A camada Baileys permanece
coexistente e nao recebeu mudanca de versao, configuracao, sessao ou logica.
Numero oficial, credenciais, painel, funis, produtos, precos, VSL, checkout,
Dropi, Meta/CAPI, pixel, midias, audios, memoria, pedidos, schedulers e
pos-venda permanecem inalterados. Nenhum envio real e autorizado por esta
validacao.

## Validacao e rollback

- `npm ci --ignore-scripts`
- `npm run guard:baileys-security-v59`
- `npm run senior:check`
- `npm test`
- `node scripts/audit-ec-product-micro-layer.mjs`
- `node scripts/audit-guide-print-spam-guard.mjs`

Rollback: reativar integralmente a release V58
`/opt/vitalismen-automacao/releases/20260824T123239Z_production-20260824-812fb25`.
Bancos, mensagens, pedidos e midias compartilhadas nao devem ser removidos.
