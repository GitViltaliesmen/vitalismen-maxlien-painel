# Resultado da ativação — mídia manual no pós-venda EC

## Resultado

- O envio manual de áudio, imagem e vídeo pelo painel oficial foi liberado para
  pedidos que já possuem vínculo com o Dropi.
- A liberação vale somente para a ação humana identificada por
  `sendMode=manual_panel`.
- Os schedulers e demais envios automáticos continuam sujeitos ao bloqueio por
  pedido Dropi existente e às travas persistidas contra reenvio.
- O bot e o pós-venda permaneceram ativos; esta ativação não alterou o conjunto
  operacional de flags, o funil, preços, checkout, Dropi, Meta/CAPI, pixel,
  número de WhatsApp ou memória de pedidos.

## Causa confirmada

A rota `POST /api/whatsapp/send` já marcava o envio como manual, mas
`sendWhatsAppMessage` não propagava essa autorização aos módulos de áudio,
imagem e vídeo. O módulo de mídia interrompia a operação antes da chamada à
Z-API quando encontrava um pedido Dropi existente. O painel registrava então a
tentativa como `unconfirmed`, sem `provider` e sem `providerMessageId`, exibindo
`WhatsApp nao retornou confirmacao da midia; conferir no aparelho.`

Foram encontrados oito registros históricos com esse padrão: sete imagens e
um áudio. Eles foram preservados como trilha de auditoria; não foram marcados
artificialmente como enviados e não foram reenviados automaticamente.

## Git, release e rollback

- PR da correção:
  `https://github.com/GitViltaliesmen/vitalismen-maxlien-painel/pull/30`.
- Commit de produção: `eedf503f62404dfa15fa715e7f5627807aaf7640`.
- Tag: `production-20260822-eedf503`.
- Release ativa:
  `/opt/vitalismen-automacao/releases/20260822T025119Z_production-20260822-eedf503`.
- Backup anterior à ativação:
  `/opt/vitalismen-automacao/backups/pre-media-manual-20260822T025300Z`.
- Release de rollback preservada:
  `/opt/vitalismen-automacao/releases/20260822T002400Z_production-20260822-b50a86b`.
- Permit root de uso único consumido após a ativação; rollback não executado.

## Validação de saída real

Os canários foram enviados somente ao telefone QA autorizado, pela mesma rota
do painel, sem chamada direta ao provedor.

- Áudio OGG/Opus: aceito com HTTP 200; mensagem Z-API
  `3EB048B7F966B52EB879B3`; callback final `delivered`, `ack=2`, sem erro.
- Vídeo MP4: aceito com HTTP 200; mensagem Z-API
  `3EB06945CA631B7AD042C5`; callback final `delivered`, `ack=2`, sem erro.
- O banco contém somente um registro Z-API para cada identificador do canário;
  não houve duplicação de bolha.
- Os logs dos canários mostram uso da Z-API e os callbacks correspondentes,
  sem bloqueio `dropi_order_exists`.

## Validação de recebimento

- Um áudio real recebido hoje foi persistido como `READY`, em OGG/Opus, com
  `154193` bytes e sem erro de mídia.
- O endpoint protegido do painel respondeu HTTP 206 a uma requisição Range,
  com `Content-Type: audio/ogg` e `Content-Range: bytes 0-15/154193`.
- A assinatura de vídeo validou o MP4 do canário com `video/mp4`, codec `mp4`,
  `9957986` bytes e dentro do limite de entrada.
- A suíte V30 também aprovou a hidratação de vídeo no painel.

Ainda não chegou um vídeo externo novo após esta ativação. Portanto, o envio de
vídeo está comprovado de ponta a ponta até o callback da Z-API, e o contrato de
entrada está validado, mas a prova operacional de um vídeo novo recebido do
aparelho para o painel permanece pendente. Para fechá-la sem ambiguidade, o
telefone QA deve enviar um vídeo novo ao número oficial.

## Validação técnica

- GitHub Actions: Node 20, Node 22 e Cloudflare Pages aprovados.
- Suíte completa no Linux do release: `257/257` testes aprovados.
- Testes específicos do envio manual: `6/6` aprovados no release ativo.
- `SENIOR-GUARD`: OK com o `.env` oficial.
- Guards de microcamada EC, catálogo Dropi, retirada, contatos, freeze lock e
  anti-spam: OK.
- Health: `status=online`, engine `Z-API`, `zapiConnected=true` e
  `degradedReasons=[]`.
- PM2 `vitalismen-automation`: `online`, PID `2099109`, com
  `pm_cwd=/opt/vitalismen-automacao/current` e
  `pm_exec_path=/opt/vitalismen-automacao/current/src/index.js`.
- O release ativo contém a autorização manual nos três módulos:
  `sendAudio.js`, `sendImage.js` e `sendVideo.js`.

## Estado operacional do pós-venda

O conjunto oficial permaneceu no modo operacional aprovado, incluindo resposta
automática, roteamento inbound pela Z-API, funil e schedulers protegidos de
pós-venda. Nenhuma flag isolada foi alterada e nenhum fluxo legado foi religado.

