# Congelado - Observacao do Funil Ativa Somente Leitura

Data: 2026-05-27

## Status

Congelado.

## Rota correta

- Pagina informativa publica preservada:
  - `https://ec.maxlien.shop/observation.html`
- Observacao interna do painel:
  - `https://ec.maxlien.shop/painel-observacao.html?v=20260528`

## Regra definitiva desta camada

A Observacao permanece ativa para observar, detalhar e relatar tudo, mas nao executa acao operacional.

Ela pode:

- ler historico de conversas e pedidos
- gerar relatorios automaticos
- gerar relatorios manuais quando solicitado
- apontar perdas por etapa
- apontar objeções
- apontar melhores horarios
- apontar desempenho de texto, audio, imagem, video e documento
- apontar bonus pendente, recuperacao, recompra e sugestoes

Ela nao pode:

- enviar mensagem
- alterar status de lead
- confirmar pedido
- enviar pedido para Dropi
- editar cliente
- excluir cliente
- alterar pagina informativa publica
- alterar funil automaticamente
- mexer em planilhas ou historico

## Validacao

- VPS `vitalismen-automation` online.
- Rota publica `/observation.html` preservada como pagina informativa.
- Rota interna `/painel-observacao.html?v=20260528` usada pelo painel.
- Log recente confirmou relatorio salvo:
  - `[OBSERVATION] Relatorio salvo: 6a178f9826b557ab0e6a57e1`

## Proxima frente

Abrir outra etapa separada, sem misturar com este congelamento.
