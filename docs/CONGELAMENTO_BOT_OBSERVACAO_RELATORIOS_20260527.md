# Congelamento - Bot de Observacao e Relatorios

Data: 2026-05-27

## Estado aprovado

Camada de observacao criada e ativada como modulo somente leitura.

Ela observa conversas, gera relatorios e sugere melhorias de funil, mas nao executa nenhuma acao no cliente.

## O que ficou ativo

- Modelo `ObservationReport` para armazenar relatorios no MongoDB.
- API autenticada em `/api/observation`.
- Pagina `/observation.html`.
- Link `Observacao` no topo do painel integrado.
- Observador automatico independente do scheduler geral.
- Execucao automatica a cada 60 minutos.
- Primeira execucao automatica validada no VPS.

## Limites de seguranca

O bot de observacao nao pode:

- enviar mensagens;
- alterar status de cliente;
- enviar pedido para Dropi;
- alterar planilhas;
- mexer em historico;
- liberar trafego fora do piloto;
- aplicar sugestoes sem aprovacao humana.

## Armazenamento

Relatorios ficam armazenados no MongoDB na collection de `ObservationReport`.

Cada relatorio contem:

- janela analisada;
- numero de mensagens;
- numero de conversas;
- achados por prioridade;
- frase do cliente;
- resposta atual do bot, quando existir;
- motivo da perda potencial;
- resposta sugerida;
- audio sugerido;
- prova social sugerida;
- status recomendado;
- acao recomendada.

## Configuracao VPS

- `OBSERVATION_REPORTS_ENABLED=true`
- `OBSERVATION_COUNTRY=EC`
- `OBSERVATION_REPORT_INTERVAL_MINUTES=60`
- `OBSERVATION_LOOKBACK_HOURS=24`
- `OBSERVATION_MESSAGE_LIMIT=900`
- `OBSERVATION_MAX_FINDINGS=80`

## Validacoes

- `node --check` passou para os arquivos novos.
- `npm run senior:check` passou no VPS.
- PM2 reiniciado com `--update-env`.
- Log confirmou: `[OBSERVATION] Observador ligado em modo somente leitura a cada 60 minutos.`
- Log confirmou primeiro relatorio automatico: `[OBSERVATION] Relatorio salvo`.

## Backups relacionados

- `/opt/vitalismen-automacao/backups/camada-observacao-funil-20260527-185655`
- `/opt/vitalismen-automacao/backups/camada-observacao-scheduler-independente-20260527-185905`

## Proximo passo permitido

Ler os relatorios, escolher sugestoes e transformar apenas o que for aprovado em camada separada do funil.
