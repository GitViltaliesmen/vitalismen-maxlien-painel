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

## Correcao de desempenho

Data: 2026-05-27

Motivo: a tela de Observacao podia travar o navegador por alguns segundos ao carregar a lista, porque a API de listagem trazia os relatorios completos com todos os detalhes.

Correcao:

- A listagem agora retorna somente metadados leves: titulo, status, pais, periodo, resumo e datas.
- O relatorio completo continua sendo carregado apenas quando o operador clica em um relatorio.
- A tela passou a listar os 15 relatorios mais recentes, em vez de 30.
- A Observacao continua somente leitura.

Medicao no VPS antes da correcao:

- lista completa de 16 relatorios: aproximadamente `484783` bytes
- lista leve equivalente: aproximadamente `11393` bytes
- reducao estimada: `97.6%`

Validacao apos publicar:

- lista publicada de 15 relatorios: `11512` bytes
- a lista nao traz mais `insights`, `findings` ou `recommendations`
- o detalhe completo continua disponivel quando clicar em um relatorio
- backup do VPS:
  - `/opt/vitalismen-automacao/backups/observacao-lista-leve-20260527-221037`

## Proxima frente

Abrir outra etapa separada, sem misturar com este congelamento.
