# Congelamento V39 — produto direto, nome do cliente e anti-reenvio pós-venda

Data: 2026-08-22
País: Equador
Status: ativação transacional autorizada pelo operador na conversa
Pai imutável: `inbound-media-path-portability-v38-20260822`

## Objetivo autorizado

Esta microcamada corrige somente quatro fronteiras do atendimento EC:

1. exibir e preencher automaticamente o nome já conhecido do cliente no painel;
2. reconhecer um cliente antigo ou entrada direta que peça explicitamente
   `Vit Power`, `Nitrix Oxide` ou `Tex Ultra`, sem atribuir essa mensagem a uma
   VSL que não ocorreu;
3. apresentar valores normais fora da VSL e liberar valores promocionais apenas
   após pedido explícito de preço mais baixo, desconto ou reclamação de preço;
4. consultar o histórico persistido antes de qualquer tentativa de reenvio dos
   áudios `AGRADECIMENTO_AGENCIA_DE_ENTREGA` e `BONUS_RETIRADA`.

## Comportamento congelado

- A origem `metadata.vslProduct*` nunca é apagada nem reescrita pela consulta
  direta.
- Uma seleção manual divergente do operador permanece soberana. A microcamada
  pode responder a informação solicitada, mas não troca o produto bloqueado na
  ficha pelo operador.
- Um pedido explícito sem ambiguidade cria memória própria do produto atual. Se
  a mensagem citar dois produtos, o sistema pergunta qual deve ser tratado
  primeiro e não mistura informações ou preços.
- Fora da VSL, a primeira tabela é `normal`: 1 frasco USD 39.99, 2 frascos USD
  70.00, 3 frascos USD 95.99 e 6 frascos USD 167.99.
- A tabela `promotional` só é liberada por objeção explícita de preço: 1 frasco
  USD 35.99, 2 frascos USD 70.00, 3 frascos USD 80.99 e 6 frascos USD 147.99.
- Perguntar apenas se existe uma promoção não é classificado como objeção de
  preço; o cliente precisa pedir valor mais baixo, desconto ou reclamar do
  valor.
- A entrada autoritativa da VSL continua no funil de seu produto. `/n/` segue
  Tex Ultra, `/m/` segue Vit Power e uma entrada Nitrix comprovada segue
  Nitrix.
- O nome recebido no perfil Z-API é aceito somente quando contém letras e não é
  telefone, URL ou rótulo técnico. Nome de pedido/ficha continua tendo
  prioridade.
- A lista esquerda do painel continua sem qualquer prévia de mensagem.
- Os áudios de pós-venda conservam `sentAt`, lock persistente, deduplicação e
  agora também consulta explícita por histórico de mensagem/mídia antes do
  envio. Evidência histórica é gravada como `history_already_sent`.

## Isolamento e preservação

Não foram alterados:

- checkout, criação de pedido, Dropi, Meta/CAPI ou pixel;
- número oficial, credenciais, Z-API, Baileys ou sessão WhatsApp;
- tabela promocional oficial da VSL Tex Ultra;
- ordem dos funis congelados, provas, imagens ou áudios de produto;
- scheduler, exceto a barreira de histórico dentro da camada pós-venda já
  existente;
- produto de origem da VSL e seleção manual por pedido;
- qualquer projeto, servidor, banco, domínio ou operação fora do Equador.

## Anti-spam

A resposta direta usa, simultaneamente:

- `sentAt` persistido por produto e tipo de resposta;
- lock persistente de dois minutos;
- consulta ao histórico de mensagens de saída;
- `antiSpamKey` e `dedupeValue` estáveis no transporte.

O pós-venda usa os mesmos quatro níveis por pedido/etapa. O pedido auditado já
possuía os dois passos enviados e lidos; este freeze proíbe qualquer reenvio
quando essa evidência já existir.

## Testes e gates obrigatórios

- `node --test tests/ec-direct-product-name-v39.test.mjs`
- `node scripts/guard-ec-direct-product-name-postsale-v39.mjs`
- `node scripts/audit-ec-product-micro-layer.mjs`
- `node scripts/audit-guide-print-spam-guard.mjs`
- `npm run senior:check`
- `npm run official:audit`

## Ativação e rollback

A ativação só pode ocorrer por tag anotada exata, staging transacional, permit
root de uso único e troca atômica de `current`. O rollback retorna à release
V38 ativa
`/opt/vitalismen-automacao/releases/20260822T143218Z_production-20260822-dbc3cbd`
sem alterar bancos, mídia compartilhada ou estados persistidos.

No momento deste congelamento não havia sido enviada mensagem, criado pedido,
acionado Dropi/Meta, escrito no banco oficial, trocado symlink ou reiniciado
PM2 pela V39.
