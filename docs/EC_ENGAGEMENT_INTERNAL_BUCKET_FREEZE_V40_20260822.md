# Microcamada V40 — fila interna de relacionamento EC

Data: 2026-08-22.

## Decisão autorizada

Este freeze sucede a V39 e autoriza exclusivamente uma classificação operacional
interna das conversas reais da Vitalismen Ecuador. O rótulo visual pedido pelo
operador é `AQUECIMENTO`; o nome arquitetural é **fila interna de relacionamento**.

Essa fila não é o projeto externo de aquecimento. Não foi criado outro bot, VPS,
Git, banco, sessão WhatsApp, número, fila de disparo, scheduler, prompt ou processo.
O ambiente externo citado historicamente continua totalmente isolado e não é
lido, chamado, copiado, alterado, publicado nem usado como referência de runtime.

Esta autorização sucede apenas a proibição antiga de exibir uma fila interna com
esse nome no painel Vitalismen. A proibição de comunicação com qualquer projeto
externo de aquecimento permanece integral.

## Integridade obrigatória

- Nenhuma conversa artificial pode ser criada.
- A fila não inicia conversa e não envia mensagem para contato que não escreveu.
- Não existe disparo frio, disparo em massa, agenda de aquecimento ou reativação de
  contatos silenciosos.
- Não existe tentativa de manipular reputação, limites ou controles do WhatsApp.
- Somente uma nova entrada voluntária do próprio contato pode abrir uma decisão de
  resposta da camada.
- Emoji, sticker, imagem, vídeo, áudio, link simples, reação ou conteúdo sem pergunta
  não chama modelo de IA e não gera resposta automática nesta versão.
- Conteúdo sexual explícito, ameaça, fraude, opt-out ou mídia insistente/ambígua vai
  para `REVISAR`; nunca é alimentado automaticamente.
- A resposta automática local exige `EC_ENGAGEMENT_AUTO_REPLY_ENABLED=true`.
- Mesmo habilitada, usa no máximo uma resposta para a entrada persistida, lock no
  `ContactState`, consulta da identidade da entrada, cooldown, limite diário e
  histórico persistente. Falha não é repetida automaticamente.
- O classificador e os templates desta versão usam zero chamadas de modelo e custo
  estimado de IA igual a zero.

## Filas oficiais

Cada `ContactState` continua único. Nenhum histórico, pedido, mídia, nome, telefone,
endereço, origem VSL ou memória comercial é duplicado.

O campo `conversationBucket.value` aceita somente:

1. `attendance` — `ATENDIMENTO`;
2. `engagement` — `AQUECIMENTO`;
3. `orders` — `PEDIDOS`;
4. `review` — `REVISAR`.

O painel mostra cada conversa em uma única fila. Uma obrigação operacional ativa de
pedido ou shipment projeta a conversa em `PEDIDOS`, sem apagar o bucket anterior e
sem esconder a obrigação. Quando a obrigação termina, a classificação volta a ser
avaliada por entrada real ou ação humana.

## Exclusões máximas do AQUECIMENTO

A conversa não pode entrar nem permanecer automaticamente em `AQUECIMENTO` quando
houver qualquer um destes sinais:

- intenção de compra, produto, preço, desconto ou objeção de preço;
- quantidade, fechamento, pedido, pagamento, endereço ou entrega;
- Servientrega, guia, retirada, devolução, reclamação ou suporte;
- pedido/shipment operacional ativo;
- risco sexual, ameaça, fraude, pedido de credencial ou opt-out;
- contato brasileiro protegido de QA;
- predominância de mídia/link sem diálogo seguro suficiente.

Compra ou objeção de preço retorna a `ATENDIMENTO`. Pedido/suporte retorna a
`PEDIDOS`. Risco ou ambiguidade retorna a `REVISAR`.

## Entrada segura de alta confiança

O movimento automático para `AQUECIMENTO` exige diálogo bidirecional real e recente:

- pelo menos quatro entradas do contato;
- pelo menos duas respostas da operação;
- pelo menos dois dias ativos;
- pelo menos três textos conversacionais;
- pelo menos uma pergunta;
- ausência de exclusões;
- mídia/links não podem dominar a conversa.

Uma marcação manual válida por `#AQUECE` continua disponível. A tentativa é recusada
quando a auditoria encontra uma exclusão máxima. `#NAOAQUECE` retorna para
`ATENDIMENTO`; `#RISCO` envia para `REVISAR`. Esses códigos continuam sendo
interceptados pelo painel e nunca são enviados ao cliente.

## Resposta inbound local

Quando o contato elegível escreve de novo e a flag operacional está ativa, a camada
pode escolher apenas um template local curto para saudação, bem-estar, pergunta ou
relato. A camada:

- espera entre 12 e 25 segundos por padrão;
- cancela a tentativa antiga quando existe entrada mais nova;
- não responde se um humano atuou nos dez minutos anteriores;
- aplica cooldown padrão de trinta minutos;
- aplica teto padrão de quatro respostas por dia, em `America/Guayaquil`;
- alterna templates sem repetir o anterior;
- registra entrada, template, provider, resultado e custo zero;
- não usa áudio, foto, vídeo, documento, link, produto, preço ou oferta;
- não cria pedido, Dropi, Meta/CAPI ou evento comercial.

## Auditoria READ-ONLY anterior à implementação

A leitura oficial foi feita sem alterar banco e sem enviar mensagens.

- `830` estados EC existentes no Mongo;
- `15.549` registros de mensagem no banco;
- `185` pedidos EC e `172` shipments EC;
- `7` contatos já possuíam marca manual `warmup:allowed`;
- pelo corte conservador inicial, somente `1` contato antigo atingiu alta confiança
  para relacionamento automático;
- os demais casos foram classificados como atendimento, pedido/suporte ou revisão;
- nenhum movimento em massa foi executado.

## Caso auditado: EC-ADMIN-2943

- telefone auditado: `+593980353272` não participou desta auditoria V40; ele pertence
  ao fechamento V39 anterior e permanece preservado;
- alvo desta missão: `+593984302981`;
- nome consolidado: `Gustavo Vargas`;
- ficha administrativa: `EC-ADMIN-2943`;
- entrada original no painel administrativo: `2026-07-18T08:17:31.832464Z`;
- estado administrativo: `atendendo`;
- nenhum pedido Mongo/Dropi ativo foi encontrado para esse telefone;
- `294` registros técnicos foram encontrados na primeira leitura completa; após
  deduplicação de espelhos provider/manual, a auditoria encontrou `248` eventos
  lógicos no recorte usado;
- o histórico contém links/mídia insistente e conteúdo sexual explícito;
- classe correta: `REVISAR/RISCO`, manual somente;
- a marca antiga `warmup:allowed` não é evidência suficiente e deve ser substituída
  pela classificação de risco, sem enviar mensagem ao contato.

## Preservado da V39 e dos freezes anteriores

- `/protocolo-g` e `/n/` continuam Tex Ultra;
- `/m/` continua Vit Power;
- Nitrix continua somente por entrada explicitamente identificada;
- origem VSL e produto atual continuam separados;
- produto direto fora da VSL continua tabela normal antes de objeção e promoção
  somente após pedido de desconto/objeção explícita;
- preços, checkout, Dropi, Meta/CAPI, pixel, Z-API, número oficial, mídias, áudios,
  pós-venda, scheduler e PM2 não são alterados;
- o pós-venda V39 continua com agradecimento e bônus protegidos por histórico,
  lock e antirrepetição;
- a lista esquerda do painel continua sem texto de mensagem.

## Publicação e rollback

A implementação, os testes e a ativação transacional desta V40 foram autorizados no
texto anexado pelo operador em 2026-08-22, com permissão para prosseguir da auditoria
READ-ONLY até implementação, testes e publicação. A ativação exige:

1. suíte e guard V40 integralmente verdes;
2. nenhum envio real em teste;
3. backup/release anterior preservado;
4. PR auditável, CI verde e tag imutável;
5. staging oficial e ativação pelo helper transacional;
6. `current`, `pm_cwd` e `pm_exec_path` apontando para a mesma release;
7. health, Z-API, `/n/` e `/qr.html` aprovados.

Rollback operacional: reativar a release V39 preservada e restaurar a flag
`EC_ENGAGEMENT_AUTO_REPLY_ENABLED=false`. O histórico de bucket é reversível e não
apaga contato, mensagem, pedido ou shipment.
