# Freeze V38 — portabilidade do teste de caminho da mídia inbound

Data: `2026-08-22`

País: `EC`

Pai: `panel-zapi-auth-status-v37-20260822`

## Evidência e causa

O teste `tests/inbound-media-storage.test.mjs` passava diretamente o caminho
Linux `/opt/vitalismen-automacao/releases/...` ao `node:path` nativo do
Windows. Nesse sistema, `path.resolve()` converte esse valor para `C:\opt\...`,
e a asserção comparava o resultado com a raiz POSIX da VPS.

A segunda asserção do mesmo teste também exigia separadores `/`, embora a raiz
local devolva corretamente separadores nativos no Windows.

## Contrato da correção

1. O serviço congelado `src/services/inboundMediaStorageService.js` permanece
   byte a byte igual ao freeze V30.
2. No Linux, releases sob `/opt/vitalismen-automacao/` continuam usando
   `/opt/vitalismen-automacao/shared/media/inbound`.
3. No Windows, um texto que começa por `/opt/` é tratado por `node:path` como
   caminho local da unidade atual e usa `.runtime/media/inbound`.
4. A raiz local é comparada com `path.resolve()` e `path.join()`, sem assumir o
   separador de outro sistema operacional.
5. O teste não é pulado: as duas plataformas validam seu contrato nativo.

## Preservado

- serviço, schema, captura, autenticação e entrega de mídia inbound;
- storage compartilhado oficial da VPS;
- painel, Z-API, número oficial e sessão;
- Tex Ultra, Nitrix Oxide e Vit Power;
- funis, preços, ofertas, áudios, imagens e vídeos;
- pedidos, Dropi, Meta/CAPI, pixel, scheduler e pós-venda;
- locks persistentes e travas anti-spam;
- todos os freezes V28 a V37.

## Autorização de ativação

Em `2026-08-22T14:27:24Z`, o operador autorizou expressamente commit, push, PR,
tag, staging e ativação da V38 na VPS oficial. A autorização exige o helper
transacional root com permit de uso único, preservação da release anterior e
validação de `current`, PM2, health e domínio depois da promoção.

O escopo continua restrito à portabilidade do teste. A autorização não permite
alterar o comportamento do serviço de mídia ou qualquer fluxo comercial.

## Efeitos reais no congelamento

Nenhuma mensagem de WhatsApp, mídia, pedido, Dropi, Meta/CAPI, escrita no banco
oficial, alteração de PM2, symlink ou deploy foi executada.

## Rollback

Remover a microcamada V38 e restaurar o teste protegido pelo manifesto V30. A
release V37 ativa e o storage compartilhado inbound não devem ser alterados.
