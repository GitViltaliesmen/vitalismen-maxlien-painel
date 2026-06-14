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
- Release ativo VPS: `/opt/vitalismen-automacao/releases/202606140418`.
- PM2: `vitalismen-automation` online.
- Z-API conectada no momento da primeira checagem: `553171862958`.
- Atualizacao posterior aprovada: entrada operacional/VSL trocada para `5515991418416` apos troca do aparelho conectado na Z-API.
- Observacao operacional: apos o congelamento tecnico, a Z-API voltou a oscilar entre conectada e desconectada. A camada de webhook/envio fica pronta, mas a estabilidade do aparelho depende de manter internet/celular estaveis antes de trafego real.
- Webhook inbound pronto: `/api/zapi/webhook` e `/api/zapi/webhook/received`.

## Commits congelados

- `f7b2d1e` - rota avisos de guia com contexto de pais.
- `44830d7` - texto de salvar contato com Ana Lopez.
- `de7fdbe` - comandos seguros de aquecimento no painel.
- `29aff6e` - remocao dos botoes redundantes do topo.
- `89db9f7` - lista completa de codigos internos do painel.
- `6d1eaec` - rota `/api/zapi/whatsapp-link` para a VSL consultar telefone conectado pela Z-API.

## Evidencias

- `GET /api/zapi/status` na primeira checagem: `ok: true`, `connected: true`, `smartphoneConnected: true`, telefone `553171862958`.
- `GET /api/zapi/status` em checagem posterior: oscilou para `ok: false`, `You are not connected`.
- `public/qr.html` publicado contem botao `Codigos` e codigos `#HUMANO`, `#FECHADO`, `#BOT_LIBERADO#`, `#AQUECE#`, `#GUIA_ENVIADA#`.
- VSL ativa `https://maxlien.shop/m/` retornava `553171862958` e foi atualizada depois para retornar somente `5515991418416` como entrada WhatsApp.
- Fallback antigo do MVP em `/opt/maxlien-mvp/app.py` foi alterado no VPS de `553183002800` para `553171862958` e depois para `5515991418416`.
- Rota `/api/zapi/whatsapp-link` publicada; quando Z-API estiver conectada, retorna telefone do device. Apos a troca, retornou `5515991418416`.
- Variaveis operacionais do Node no VPS atualizadas para `5515991418416`: `WHATSAPP_SELLER_E164`, `ZAPI_OPERATION_PHONE`, `ZAPI_CONNECTED_PHONE` e `ZAPI_OPERATIONAL_PHONE`.
- Ajuste posterior de conversao: CTA/formulario da VSL reduziu fallback absoluto de 40 minutos (`2400s`) para 12 minutos (`720s`) para evitar perda de vendas se o CTA nativo nao aparecer.
- Consulta dinamica do telefone Z-API no clique reduziu timeout de `2500ms` para `900ms`; se a API atrasar, o fallback `5515991418416` continua abrindo.
- Correcao local posterior: a lista rapida do painel EC agora fixa os contatos BR permitidos/teste para nao sumirem depois de sincronizacao grande de clientes. Validado em `GET /api/whatsapp/chats?country=EC&fast=1` com `5515998038637`, `553171862958`, `5531983002800` e `5531971862958` visiveis.
- Variaveis locais `ZAPI_OPERATION_PHONE`, `ZAPI_CONNECTED_PHONE` e `ZAPI_OPERATIONAL_PHONE` atualizadas para `5515991418416`, mantendo `5515998038637` apenas como numero de teste liberado.
- Correcao publicada no VPS `202606140418`: lista do painel agora ordena pelo maior horario entre ficha/pedido e ultima mensagem. Validado no oficial com `5515998038637` em primeiro lugar e ultima mensagem `Hola, vengo del video...` com `entryAt=2026-06-14T04:13:24.000Z`.
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
- Processo completo de pedido enviado, confirmado pelo usuario em 2026-06-14 02:01 America/Sao_Paulo: pedido Equador salvou normalmente, entrou no fluxo correto e foi enviado. Pedido de numero BR nao precisa virar confirmado; ficou tratado como teste/operacional, sem bloquear o fluxo real EC.
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
- Cliente comum/real sempre tem prioridade sobre aquecimento, teste, contato BR operacional ou conversa leve. Se houver lead novo, cliente em atendimento, pedido, guia, reclamacao, Dropi ou duvida de compra aguardando, qualquer aquecimento deve parar/aguardar.
- A extensao de aquecimento so pode entrar em acao por codigo interno aprovado, catalogacao manual ou repeticao clara de conversa segura; foto, link, audio ou mensagem solta nao autorizam `#AQUECE#` automaticamente.
- Foto, link, audio, emoji solto ou frase curtissima com emoji sem contexto/repetidos entram como `#RISCO#`/manual, nao como aquecimento. Pornografia ou conteudo sexual explicito e `#RISCO#` imediato.

## Pendencias Para Trafego Pago

1. Confirmar novamente PageView, Lead e Purchase no dataset EC `1468946114265008`.
2. Confirmar token CAPI EC ativo sem test event code de producao.
3. Confirmar Purchase com `USD`, valor positivo e lock anti-duplicidade.
4. Fazer novo teste final de formulario real quando iniciar trafego: anuncio/VSL -> lead -> atendimento -> confirmado -> Purchase.
5. Confirmar dominio EC, VSL mobile, checkout no tempo correto e desktop protegido.
6. Conferir que Dropi continua exigindo autorizacao manual antes de envio real.
7. Numero oficial atual `5515991418416` testado com inbound no painel; qualquer nova troca de numero deve repetir inbound/outbound simples antes de trafego.
8. Manter Z-API conectada sem oscilacao por um periodo de observacao antes de iniciar trafego.
9. Se trocar o numero oficial de WhatsApp, atualizar VSL, fallback MVP e variaveis Z-API juntos.
10. Observar conversao do CTA de 12 minutos antes de reduzir mais; se lead ficar frio, testar 8 minutos como nova camada.

## Regra De Retomada

Retomar deste congelamento antes de qualquer mudanca grande em trafego pago, aquecimento ou automacao. Se algo falhar, comparar contra os commits acima e contra o backup VPS correspondente antes de reverter.
