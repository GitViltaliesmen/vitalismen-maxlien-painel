# Congelamento - Observacao de Midia e Nao Interferencia

Data: 2026-05-27

## Objetivo

Adicionar ao bot de observacao uma leitura de quais mensagens geram mais interacao, venda e recompra, sem alterar o funil, sem enviar mensagens e sem interferir no atendimento.

## O que foi aplicado

- Relatorio agora mede desempenho por tipo de mensagem:
  - texto
  - audio
  - imagem
  - video
  - documento
- Metricas registradas:
  - interacao: cliente respondeu em ate 24h apos a mensagem
  - venda: pedido confirmado em ate 72h apos a mensagem
  - recompra: venda com compra anterior detectada para o mesmo telefone
- Tela de Observacao ganhou bloco "Mensagens que mais geram resultado".
- Tela de Observacao nao abre mais automaticamente o relatorio mais recente.
- Ao abrir Observacao, primeiro mostra somente a lista e aguarda o clique humano em um relatorio.
- Link do painel para Observacao foi versionado como `/painel-observacao.html?v=20260528` para evitar cache antigo.
- A rota `/observation.html` pertence a pagina informativa publica e nao deve ser usada pelo painel.
- A Observacao do funil usa rota propria do painel: `/painel-observacao.html`.
- API publica autenticada `/api/observation/` foi roteada para o painel integrado.

## Regra de seguranca

Esta camada e somente leitura.

Nao faz:

- envio de WhatsApp
- alteracao de status
- criacao de pedido
- envio para Dropi
- edicao de cliente
- alteracao em planilhas
- exclusao de dados

O papel da Observacao e mostrar resultado, analisar e sugerir. A aplicacao de mudancas no funil continua dependendo de revisao e aprovacao humana.

## Validacao executada

- `node --check src/services/observationReportService.js`
- `node --check src/models/ObservationReport.js`
- `npm run senior:check` no VPS
- PM2 `vitalismen-automation` reiniciado e online
- Relatorio real gerado no VPS:
  - ID: `6a178df2b50eb9a4169ddc41`
  - janela: ultimas 24h
  - conversas: 11
  - mensagens: 126
- Resultado inicial da amostra:
  - texto: 15 envios, 2 interacoes, 13.3% de interacao, 0 vendas atribuida na janela
  - audio: 7 envios, 0 interacoes, 0 vendas atribuida na janela

Observacao: a amostra ainda e pequena e serve como sinal inicial, nao como decisao definitiva de copy.

## Backups

- Arquivos do app antes da publicacao:
  - `/opt/vitalismen-automacao/backups/observacao-midia-nao-interfere-20260527-213539`
- Link versionado de Observacao:
  - `/opt/vitalismen-automacao/backups/qr-observacao-link-cache-20260527-213947`
- Nginx:
  - `/etc/nginx/sites-enabled/maxlien.shop.conf.bak-observacao-20260528-003751`
  - `/etc/nginx/sites-enabled/ec.maxlien.shop.clean.conf.bak-observacao-20260528-003843`
- Correcao posterior: a rota publica `/observation.html` foi devolvida para a pagina informativa, e o painel passou a usar `/painel-observacao.html`.

## Status

Congelado e publicado no VPS.
