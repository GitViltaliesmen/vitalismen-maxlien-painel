# Freeze V30 — Durabilidade e autenticação de mídia

Data: 2026-08-21

País: EC

Base: `b26bacdd6c72711a70834e69915285e677649f1a`

Pai: `guard-alias-integration-v29-2-20260818`

## Evidência e causa

- Z-API é o transporte oficial e os callbacks recentes comprovam áudio outbound em `delivered`/`read`; não há evidência de falha global de envio.
- Os arquivos outbound auditados possuem MIME coerente e os OGG usados como PTT são Opus 48 kHz mono.
- O painel exige Bearer (`PANEL_AUTH_DISABLED=false`), mas os elementos nativos `<audio>`/`<img>` tentavam abrir `/api/whatsapp/media-proxy` diretamente. Esses elementos não adicionam o header e a rota respondia 401.
- A URL inbound era persistida como URL temporária do provider e só era baixada quando o painel abria a mídia.
- O cache ficava em `public/media/remote-cache` no diretório do release, portanto não era durável entre ativações.
- Há 404 históricos do proxy compatíveis com expiração da URL temporária.

## Contrato aprovado nesta microcamada

1. O webhook inbound registra a mídia pelo mesmo `_id`/`providerMessageId` da mensagem real.
2. Estados persistidos: `RECEIVED → FETCHING → STORED → READY`; qualquer erro termina em `FAILED` com motivo.
3. O download é único, imediato e protegido por lock persistido com expiração.
4. Somente HTTPS allowlisted é aceito; cada redirect é revalidado antes do próximo request.
5. O conteúdo é limitado por tamanho e validado por assinatura, MIME real, tipo esperado e codec suportado.
6. O arquivo é gravado atomicamente em `/opt/vitalismen-automacao/shared/media/inbound` e verificado antes de `READY`.
7. O painel recebe apenas `/api/whatsapp/media/:messageId`; `providerMediaUrl` e caminho físico não fazem parte do select comum.
8. O browser baixa o endpoint protegido com Bearer, cria uma URL `blob:` e nunca coloca token na URL.
9. Falha mostra motivo explícito e não produz ícone/player quebrado.
10. Histórico legado pode usar o proxy anterior, também carregado por Blob autenticado.

## Clean Chat V29 preservado

- `VitalismenCleanChatV29.presentMessages` continua sendo a única camada de apresentação.
- O provider ID continua a identidade canônica.
- Áudio, imagem e documento com espelho de banco continuam unificados.
- Estado de envio/entrega/leitura enriquece a mesma bolha.
- Nenhum histórico é removido, migrado ou duplicado pela V30.

## Pós-venda preservado

- Nenhuma regra READY/IN_TRANSIT/PICKED_UP/DELIVERED foi alterada.
- Nenhum scheduler ou remetente foi alterado.
- Nenhum aviso foi enviado durante implementação ou teste.
- A reconciliação e os locks anti-spam permanecem nos arquivos já publicados.

## Testes mínimos

- outbound: MP3, OGG/Opus, arquivo ausente, MIME incorreto, URL inválida/insegura, aceite/rejeição Z-API e normalização de delivery;
- inbound: OGG/Opus, URL temporária, replay pelo cache persistente, 401/403/404, arquivo vazio, limite, redirect inseguro e codec inválido;
- imagem: JPEG, PNG, WebP, assinatura inválida e MIME divergente;
- UI: Bearer no header, ausência de token na URL, Blob, fallback explícito, endpoint após auth e regressão V29 de uma bolha.

## Autorização posterior ao relatório

Em `2026-08-21T18:00:25Z`, o operador autorizou a publicação, release e ativação controlada da V30. Permanecem obrigatórios: nenhum disparo em massa, canário de áudio e imagem e manutenção da Z-API até o WhatsApp Web estar efetivamente conectado. A retirada da Z-API não faz parte desta ativação.

## Efeitos reais antes da ativação

- mensagem WhatsApp: não;
- aviso de retirada: não;
- pedido/Dropi: não;
- Meta/CAPI: não;
- escrita no banco oficial: não;
- deploy/release/PM2/current: não;
- ativação: autorizada de forma controlada, condicionada aos guards e ao canário.

## Rollback

Retornar ao commit base `b26bacdd6c72711a70834e69915285e677649f1a`. Os campos aditivos no Mongo podem permanecer sem uso. Se a V30 for ativada futuramente, os arquivos persistidos em `shared/media/inbound` devem ser preservados para auditoria; remoção exige autorização separada.
