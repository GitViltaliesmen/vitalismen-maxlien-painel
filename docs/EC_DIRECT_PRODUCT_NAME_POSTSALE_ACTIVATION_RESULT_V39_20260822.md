# Resultado da ativação V39 — produto direto, nome e anti-reenvio pós-venda

Data: 2026-08-22
País: Equador
Status: ativa e validada em produção

## Fonte imutável

- PR funcional: `#41`.
- Commit funcional: `e191a6e212af866f25528fdd8af5ff517ca247a2`.
- Tag anotada: `production-20260822-e191a6e`.
- Release GitHub: `V39 — produto direto, nome e anti-reenvio`.
- Freeze: `ec-direct-product-name-postsale-v39-20260822`.

A branch `production`, a tag e o candidato apontavam para o mesmo commit antes
da ativação. A branch temporária funcional foi removida após a fusão.

## Staging oficial

- Release:
  `/opt/vitalismen-automacao/releases/20260822T152503Z_production-20260822-e191a6e`.
- Staging concluído em `2026-08-22T15:27:41Z`.
- `current` permaneceu na V38 durante todos os gates.
- PID PM2 permaneceu `2152686` durante o staging.
- `npm ci --omit=dev`: concluído.
- Auditoria oficial e freeze lock: aprovados.
- Senior check na VPS: `292/292`, sem falha, cancelamento ou teste ignorado.
- Microcamada EC: aprovada.
- Catálogo Dropi: 3 produtos e 24 combinações validados sem envio real.
- Guards de retirada, contatos, selos operacionais e freeze: aprovados.

O primeiro empacotamento local havia criado o diretório candidato sem o
marcador root oficial. Como o helper recusa corretamente qualquer release já
existente, somente esse candidato inativo foi removido após comprovar que não
era o destino de `current`. O helper root recriou e validou a release exata; a
V38, bancos, mídia compartilhada e ambiente oficial permaneceram intactos.

## Ativação transacional

- Permit root vinculado à tag, commit, release e rollback exatos.
- Permit `0600`, root e de uso único.
- Ativação concluída em `2026-08-22T15:28:06Z`.
- `current` atual:
  `/opt/vitalismen-automacao/releases/20260822T152503Z_production-20260822-e191a6e`.
- Processo reiniciado: somente `vitalismen-automation`.
- PID anterior: `2152686`.
- PID atual: `2161976`.
- Estado PM2: `online`.
- `unstable_restarts`: `0`.
- `pm_cwd`: `/opt/vitalismen-automacao/current`.
- `pm_exec_path`: `/opt/vitalismen-automacao/current/src/index.js`.
- CWD real do PID:
  `/opt/vitalismen-automacao/releases/20260822T152503Z_production-20260822-e191a6e`.
- Permit consumido; `ATIVACAO_PERMITIDA=NAO` após a conclusão.
- Rollback não executado.

## Validação pública e no navegador

- `https://ec.maxlien.shop/api/health/`: HTTP `200`, `status=online`, PID
  `2161976`, Z-API conectada e sem razão degradada.
- `https://ec.maxlien.shop/n/`: HTTP `200` e renderizada no navegador.
- `https://ec.maxlien.shop/qr.html`: HTTP `200` e tela de login renderizada.
- `https://ec.maxlien.shop/api/zapi/status` sem autenticação: HTTP `401`.
- O HTML publicado do painel contém `displayIdentity`, fallback por
  `profileName`, `#activeMeta`, `#customerNameInput` e `#conversation`.
- `document.querySelectorAll('.chat-preview .meta').length === 0`.

A checagem no navegador foi deliberadamente somente leitura: não realizou
login, não preencheu formulário e não enviou mensagem. A renderização dinâmica
de uma conversa autenticada ficou coberta pelos testes automatizados V39 e pela
presença da lógica exata no HTML público.

## Resultado funcional

- Consulta direta explícita de Tex Ultra, Nitrix Oxide ou Vit Power passa pela
  microcamada determinística.
- Fora da VSL, a primeira tabela é a normal.
- A promoção só é liberada depois de objeção explícita de preço.
- Mensagem ambígua com dois produtos pede escolha e não mistura valores.
- Origem da VSL e seleção manual do operador permanecem preservadas.
- Nome válido do perfil Z-API é persistido e usado no cabeçalho/ficha; telefone
  ou rótulo técnico não vira nome.
- Áudios de agradecimento e bônus consultam `sentAt`, lock, histórico e
  deduplicação antes de qualquer envio.
- O pedido auditado já tinha os dois áudios enviados/lidos e não recebeu
  reenvio durante implementação, staging ou validação.

Nenhum canário real foi enviado. Nenhum pedido, Dropi ou evento Meta/CAPI foi
criado durante a publicação.

## Rollback preservado

Release anterior disponível:

`/opt/vitalismen-automacao/releases/20260822T143218Z_production-20260822-dbc3cbd`

O rollback preserva bancos, mídia compartilhada, histórico de contatos e
pedidos.

## Observações herdadas, não mascaradas

O `npm ci` informou três advisories transitivos no caminho coexistente
Baileys/libsignal/protobufjs. O `npm audit fix --package-lock-only --dry-run`
não propôs alteração segura (`changed: 0`). Essa dívida não foi introduzida
pela V39 e não foi alterada, pois atualizar à força esse conjunto mudaria o
transporte congelado. A operação pública oficial continua em Z-API conectada;
Baileys está habilitado somente como camada não obrigatória em `scanning`.

O smart player da VSL registrou um aviso HLS não fatal no navegador. O painel
também recebeu um erro de `MutationObserver` sem URL de origem; a string não
existe no HTML/JavaScript oficial servido, indicando instrumentação do ambiente
de teste, não código publicado. As duas páginas renderizaram e responderam
HTTP `200`.
