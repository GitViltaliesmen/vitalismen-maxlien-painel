# Microcamada V42 — comando e resposta local do AQUECIMENTO EC

Data: 2026-08-22.

## Decisão autorizada

Este freeze sucede a V41 e corrige exclusivamente a apresentação do bucket
`AQUECIMENTO` e a resposta passiva local de contatos aprovados manualmente.
A autorização foi dada pelo operador ao solicitar que `#aquece` mova o contato,
que o painel mostre a fila correta e que o sistema responda a interações sociais
sem usar IA externa.

Nenhum projeto externo de aquecimento participa desta camada. O único ambiente é
o Vitalismen Ecuador oficial em `72.60.137.77`, repositório
`GitViltaliesmen/vitalismen-maxlien-painel` e domínio `ec.maxlien.shop`.

## Base congelada antes da alteração

- SHA local e `origin/production`: `18bac1a79c00359cc6edd0945dbfa4592e0a1155`;
- release ativa: `/opt/vitalismen-automacao/releases/20260822T180506Z_production-20260822-1f4895b`;
- PID PM2 observado: `2181029`;
- branch isolada: `codex/ec-engagement-command-reply-v42-20260822`;
- árvore local limpa antes da primeira edição.

## Diagnóstico comprovado do contato

O telefone `+593986247702`, nome `José Virgilio Chanalata Nacevilla`, foi
auditado em modo somente leitura.

- `#aquece` foi interceptado e persistido às `2026-08-22T18:35:12.766Z`;
- `conversationBucket.value` já era `engagement`;
- a seleção manual foi registrada para `Administrador Maxlien`;
- nenhum `Order` EC foi encontrado no Mongo para o telefone;
- nenhum `Shipment` EC foi encontrado no Mongo para o telefone;
- `EC-ADMIN-2856` existe somente no `customerDraft` administrativo histórico;
- o status administrativo é `atendendo` e não representa obrigação logística;
- nenhuma escrita foi realizada por esta auditoria.

A causa estava no navegador: `chatConversationBucket` avaliava qualquer
`orderId` antes do bucket fornecido pelo backend. Assim, a ficha administrativa
antiga projetava falsamente `PEDIDOS`, embora o estado persistido fosse
`AQUECIMENTO`.

## Correção do painel

`public/panel-intelligence/ec-engagement-panel-v42.js` passa a resolver a fila
nesta ordem:

1. bucket validado recebido do backend;
2. fallback de pedido para registros legados sem bucket;
3. tags legadas de compatibilidade;
4. `ATENDIMENTO` como fallback final.

Uma obrigação real continua soberana porque o backend projeta explicitamente
`conversationBucket.value=orders` e `source=active_order_projection`. A V42 não
esconde pedido ou shipment ativo.

As tags `manual:aquecimento_liberado` e `warmup:allowed` continuam persistidas
para auditoria, mas o painel consolida rótulos visuais idênticos. O operador vê
somente uma etiqueta `AQUECE`.

## Contrato do comando

Continuam aceitos:

- `#AQUECE`;
- `#AQUECE#`;
- `/AQUECE`.

O comando:

- é interceptado antes do transporte;
- responde ao painel com `sent=false`;
- nunca chega ao cliente;
- é idempotente;
- preserva contato, nome, telefone, produto, origem, histórico, mídias, pedidos,
  shipments e responsável;
- não cria cliente duplicado.

`#NAOAQUECE` e `#RISCO` permanecem preservados.

## Resposta local passiva

A V42 não amplia a resposta passiva para toda a base. Ela exige simultaneamente:

- bucket persistido `engagement`;
- `manualSelectedAt` existente;
- `metadata.warmup.allowed=true`;
- ausência de bloqueio ou risco;
- nova entrada voluntária do próprio contato;
- ausência de intenção comercial, suporte, risco ou opt-out;
- telefone EC real e não pertencente ao QA protegido.

Para mensagens sem pergunta, a resposta usa somente templates locais curtos e
sem pergunta:

- saudação simples: `¡Hola! 😊`, `Buen día 🙏` ou `Saludos 😊`;
- agradecimento: `Gracias a usted 😊`, `Con gusto 🙏` ou
  `Igualmente, gracias 😊`;
- emoji, imagem, sticker, áudio sem pergunta ou link isolado: confirmação curta
  como `😊🙏`, `👍😊` ou `Gracias por compartir 😊`.

Imagem, sticker, áudio e link não são abertos, transcritos ou enviados a modelo
para produzir essa confirmação. O custo de IA permanece zero e o contador de
chamadas de modelo permanece zero.

## Travas preservadas

- espera determinística de 12–25 segundos;
- entrada mais nova cancela a tentativa anterior;
- atividade humana nos dez minutos anteriores bloqueia a resposta;
- cooldown padrão de trinta minutos;
- teto padrão de quatro respostas por dia em `America/Guayaquil`;
- lock persistente por entrada;
- histórico persistente por entrada;
- antirrepetição por contato e mensagem;
- falha de transporte não recebe retry automático;
- nenhuma conversa é iniciada;
- nenhum disparo frio ou em massa é criado.

Intenção comercial retorna a `ATENDIMENTO`; pedido/suporte retorna a `PEDIDOS`;
risco e opt-out permanecem em `REVISAR`.

## Preservado

- produtos, preços e ofertas;
- `/n/` e `/protocolo-g` como Tex Ultra;
- `/m/` como Vit Power;
- Nitrix somente por origem explicitamente identificada;
- origem VSL separada do produto atual;
- checkout, pedido, Dropi, Meta/CAPI e pixel;
- Z-API e número oficial;
- mídias, áudios e pós-venda;
- scheduler e PM2;
- busca de clientes V41;
- lista esquerda sem texto de mensagem.

## Testes sem efeitos reais

Os testes usam objetos sintéticos e funções puras. Eles não enviam WhatsApp, não
escrevem Mongo, não criam pedido, não chamam Dropi e não emitem Meta/CAPI.

## Publicação e rollback

A implementação, testes, commit, publicação e ativação transacional foram
autorizados pelo pedido explícito do operador em 2026-08-22. A ativação exige CI
verde, tag imutável, staging oficial, permit root de uso único, backup, health e
validação do painel público.

Rollback operacional: reativar a release V41
`/opt/vitalismen-automacao/releases/20260822T180506Z_production-20260822-1f4895b`.
Em emergência, `EC_ENGAGEMENT_AUTO_REPLY_ENABLED=false` desliga toda resposta de
relacionamento sem apagar a classificação dos contatos.
