# V152-E — Pareamento real controlado do WhatsApp Web

Data: 2026-09-12

## Escopo autorizado

A V152-E permite uma única sessão WhatsApp Web experimental, identificada por
`WHATSAPP_WEB_CONTROLLED_TEST_01`, exclusivamente para provar pareamento,
persistência após novo processo, inbound do telefone QA e um outbound fixo para
o mesmo telefone QA. A Z-API oficial continua conectada, roteando o tráfego de
produção e sendo a única transportadora dos clientes reais.

O telefone QA permitido é `5515998038637`. O número atual da Z-API e o número
oficial anterior são recusados pelo helper; se um deles for detectado após o
scan, a sessão Web executa logout imediatamente e falha fechada.

## Isolamento obrigatório

- sessão: `/var/lib/vitalismen-whatsapp-web-sessions/v152-e-controlled-test-01`;
- QR efêmero: `/run/vitalismen-v152-e-qr/WHATSAPP_WEB_CONTROLLED_TEST_01.png`;
- evidências sanitizadas: `/var/lib/vitalismen-v152-e-evidence`;
- permissões: diretórios `0700`, arquivos `0600`, `umask 0077`;
- symlink na raiz ou árvore da sessão: proibido;
- QR no terminal, PM2, stdout, stderr, arquivo de evidência ou Git: proibido;
- corpo do inbound, ID bruto do provider e telefone completo em evidência:
  proibidos.

O QR existe somente como PNG root-only durante o pareamento e é removido quando
a conexão abre, expira ou é contida. O material bruto nunca é emitido.

## Sequência operacional fechada

1. Rodar os guards locais, full suite, auditoria de produto, anti-spam,
   `npm audit` e senior review.
2. Gerar `pre-pairing-snapshot.json` fora da release, registrando release,
   PM2, health Z-API e hashes dos módulos congelados sem imprimir ambiente.
3. Preparar somente uma release candidata em staging; não alterar `current`,
   flags do processo principal nem reiniciar o `vitalismen-automation` para parear.
4. Executar `pair` em processo one-shot e apresentar o PNG efêmero ao operador.
5. Encerrar o processo e executar `status` em novo processo. A prova passa apenas
   se reutilizar credenciais sem novo QR.
6. Executar `canary-inbound`; aceitar somente mensagem originada do QA, persistir
   hashes e não chamar bot, painel, pedido, Dropi, Meta/CAPI ou resposta automática.
7. Executar uma vez `canary-outbound`; o texto é fixo no código. Reexecutar o
   comando deve retornar `OUTBOUND_CANARY_DUPLICATE_BLOCKED` sem rede.
8. Comparar os hashes congelados e a saúde Z-API com o snapshot.
9. Registrar a evidência final e manter o canal Web fora do roteador.

## Dedupe e resultado ambíguo

Antes da chamada real, o ledger root-only grava estado `INTENDED`. Sucesso grava
`SENT`; resposta sem ID ou erro após a intenção grava `AMBIGUOUS`. Os três estados
bloqueiam repetição automática. Não existe retry automático para o canário.

## Rollback

Rollback da sessão exige o literal `CONFIRM_V152_E_ROLLBACK`, reconecta usando a
sessão existente, executa logout e move a árvore para um arquivo recuperável sob
`/var/lib/session-backups`. O QR efêmero é removido. A Z-API não é parada,
reiniciada ou reconfigurada.

O rollback de publicação aponta `/opt/vitalismen-automacao/current` para a
release registrada como `rollbackRelease` no snapshot e valida exclusivamente o
processo `vitalismen-automation`. Esse caminho só é necessário se a publicação
alterar o runtime principal; o helper V152-E não exige restart do PM2.

## Limites permanentes desta autorização

Continuam bloqueados: migração de clientes, roteamento de cliente real para o
canal Web, handoff, failover, desligamento da Z-API e cutover. VSL, Pixel/CAPI,
Funnel Metrics, lógica comercial do bot, core do painel e pós-venda não podem ser
alterados. Qualquer cutover requer nova aprovação expressa do operador.

## Arquivos da microcamada

- `src/whatsapp/core/ControlledRealPairingV152E.js`;
- `scripts/v152-e-controlled-pairing.mjs`;
- `scripts/v152-e-preflight-snapshot.mjs`;
- `scripts/v152-e-postflight-verify.mjs`;
- `scripts/guard-v152-e-controlled-real-pairing.mjs`;
- `tests/v152-e-controlled-real-pairing.test.mjs`;
- `docs/freeze/ec-whatsapp-controlled-real-pairing-v152-e-20260912.json`;
- `scripts/lib/ec-runtime-successor-v152-e-context.mjs`.

## Estado inicial do freeze

O contrato é congelado antes da operação. Pareamento, restart, inbound, outbound
e comparação pós-prova devem ser acrescentados à receipt operacional somente
com evidência real. Até isso ocorrer, não declarar cutover nem migração.
