# Congelado - EC Z-API, Codigos Internos E Pre-Trafego

Data: 2026-06-14.
Hora de referencia: 00:26:25 America/Sao_Paulo.
Status: camada operacional pronta e publicada para continuidade segura.

## Objetivo

Preservar o estado aprovado do painel Equador apos os testes de Z-API, guias, Dropi, codigos internos do painel e catalogacao segura de aquecimento, antes da etapa final de preparacao para trafego pago.

## Escopo congelado

- Projeto oficial local: `/Users/greson/Documents/Vitalismen Automacao`.
- Painel oficial EC: `https://ec.maxlien.shop/qr.html`.
- Painel local: `http://127.0.0.1:3001/qr.html`.
- Release ativo VPS: `/opt/vitalismen-automacao/releases/202606131610-zapi-operational-tests`.
- PM2: `vitalismen-automation` online.
- Z-API conectada no momento da primeira checagem: `553171862958`.
- Observacao operacional: apos o congelamento tecnico, a Z-API voltou a oscilar entre conectada e desconectada. A camada de webhook/envio fica pronta, mas a estabilidade do aparelho depende de manter internet/celular estaveis antes de trafego real.
- Webhook inbound pronto: `/api/zapi/webhook` e `/api/zapi/webhook/received`.

## Commits congelados

- `f7b2d1e` - rota avisos de guia com contexto de pais.
- `44830d7` - texto de salvar contato com Ana Lopez.
- `de7fdbe` - comandos seguros de aquecimento no painel.
- `29aff6e` - remocao dos botoes redundantes do topo.
- `89db9f7` - lista completa de codigos internos do painel.

## Evidencias

- `GET /api/zapi/status` na primeira checagem: `ok: true`, `connected: true`, `smartphoneConnected: true`, telefone `553171862958`.
- `GET /api/zapi/status` em checagem posterior: oscilou para `ok: false`, `You are not connected`.
- `public/qr.html` publicado contem botao `Codigos` e codigos `#HUMANO`, `#FECHADO`, `#BOT_LIBERADO#`, `#AQUECE#`, `#GUIA_ENVIADA#`.
- Topo do painel nao contem mais os botoes redundantes `Pedidos` e `Novo cliente Equador`.
- Botao mantido para criacao de contato: `Adicionar`, ao lado da busca de cliente.
- Sintaxe validada local e no VPS:
  - `node --check src/routes/whatsapp.js`.
  - scripts do `public/qr.html` extraidos e compilados.

## O Que Ficou Pronto

- Captacao de mensagens recebidas via Z-API para aparecerem no painel quando o cliente fala com o numero conectado.
- Criacao/atualizacao automatica de `Message` e `ContactState` pelo webhook Z-API.
- Envio de textos, audios, imagens, midias e guias pela Z-API na camada operacional testada.
- B01, B02, B03 e audios unitarios do funil validados pelo usuario.
- Envio de pedidos para Dropi validado e confirmado pelo usuario.
- Aviso de guia real testado e confirmado no painel.
- Codigos internos do painel:
  - `#HUMANO`, `#ATENDENDO`, `#FECHADO`, `#BOT_LIBERADO#`.
  - `#AQUECE#`, `#AQUECEVIP#`, `#NAOAQUECE#`, `#RISCO#`.
  - `#DADOS_PEDIDOS#`, `#DADOS_RECEBIDOS#`, `#AUDIO_ENVIADO#`, `#PROVA_ENVIADA#`, `#PRECO_ENVIADO#`, `#AGUARDANDO_CLIENTE#`, `#ENVIADO_DROPI#`, `#GUIA_ENVIADA#`, `#RESOLVIDO#`, `#REVISAR#`.

## Regra Do Aquecimento

- Aquecimento automatico nao esta ligado.
- Os codigos apenas catalogam e registram o cliente no painel.
- Contatos marcados como `#RISCO#` ficam como manual somente.
- Nao usar esta camada para envio frio, massa ou evasao de bloqueio.
- Para ativar qualquer rotina futura de aquecimento, criar uma nova camada separada, com limites, opt-in e aprovacao manual.

## Pendencias Para Trafego Pago

1. Confirmar novamente PageView, Lead e Purchase no dataset EC `1468946114265008`.
2. Confirmar token CAPI EC ativo sem test event code de producao.
3. Confirmar Purchase com `USD`, valor positivo e lock anti-duplicidade.
4. Fazer teste final de formulario real: anuncio/VSL -> lead -> atendimento -> confirmado -> Purchase.
5. Confirmar dominio EC, VSL mobile, checkout no tempo correto e desktop protegido.
6. Conferir que Dropi continua exigindo autorizacao manual antes de envio real.
7. Trocar para numero oficial somente depois de teste inbound/outbound simples no painel.
8. Manter Z-API conectada sem oscilacao por um periodo de observacao antes de iniciar trafego.

## Regra De Retomada

Retomar deste congelamento antes de qualquer mudanca grande em trafego pago, aquecimento ou automacao. Se algo falhar, comparar contra os commits acima e contra o backup VPS correspondente antes de reverter.
