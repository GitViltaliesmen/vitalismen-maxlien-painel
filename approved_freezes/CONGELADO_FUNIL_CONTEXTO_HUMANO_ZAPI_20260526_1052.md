# CONGELADO - Funil Contextual Humano Z-API - 2026-05-26 10:52

## Status

Publicado no VPS em `/opt/vitalismen-automacao/current` e ativo no PM2 `vitalismen-automation`.

## Objetivo do congelamento

Preservar a versao aprovada do funil Vitalismen/Z-API com logica mais humana, contextual e tolerante a erros de escrita do cliente.

## Comportamentos aprovados

- Cliente pode escrever errado; o bot deve entender.
- Bot deve responder em espanhol correto, com frases curtas e naturais.
- Confirmacoes contextuais devem avancar o funil, sem repetir a mesma pergunta.
- Respostas como `SI`, `correcto`, `de acuerdo`, `bueno`, `eso`, `isso`, `iso`, `esa`, `esta`, `ahi`, `me sirve` podem confirmar etapa quando o contexto pedir confirmacao.
- Se o cliente repetir o pacote/preco, exemplo `3 frascos por $95,99`, isso conta como confirmacao do valor.
- Se o cliente corrigir agencia/setor, o bot deve procurar na lista oficial e mostrar a agencia encontrada antes de continuar.
- Agencia deve ser mostrada uma por vez, sem A/B/C.
- Se o cliente ja informou nome em frase livre, o bot deve salvar o nome e nao perguntar novamente.
- Exemplos aceitos para nome: `MI NUMBRE ES Angel Calixto Chamba Eras`, `Mi nombre es Angel...`, `Soy Angel...`, `Me llamo Angel...`, `Nombre Angel...`.
- Audio do cliente recebido pela Z-API deve ser baixado, transcrito com OpenAI e enviado ao funil como texto.
- Se a transcricao de audio falhar, o bot deve responder com fallback e nao ignorar o cliente.
- Depois do fechamento, o bot nao deve reabrir venda nem duplicar pedido.

## Arquivos criticos

- `src/services/conversationEngine.js`
- `src/services/zapiWebhookService.js`
- `src/services/inboundAudioTranscriptionService.js`

## Observacao

Este congelamento representa o ponto aprovado antes do novo teste real completo do funil.
