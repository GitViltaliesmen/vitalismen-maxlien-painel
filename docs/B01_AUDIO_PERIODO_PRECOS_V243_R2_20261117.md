PROJECT=VITALISMEN_EC — VITALISMEN OFICIAL

# B01: áudio por período e tabela final — V243 R2

Publicado e auditado em 2026-11-17T21:55:36.145387+00:00. Parent oficial `4c47bb36266d919ce664911aafcf573c7a4d1570`; release `/opt/vitalismen-automacao/releases/20261117T205344Z_production-20261117-d35d58c`; commit `d35d58c5a74fb4314d7c3548e614501453ab3ed6`; tree `6d01a73371f2e97dbf80bc6f7fee96b18a7251b7`.

## Comportamento aprovado

A entrada física anterior confirmou o defeito: a apresentação enviava dois áudios de saudação e terminava no frasco, sem tabela. Esta microcamada mantém cinco etapas: saudação em texto, um áudio escolhido pelo horário America/Guayaquil na admissão do trabalho, prova social existente, frasco Vit Power e tabela final. Bom dia: 05:00–11:59; boa tarde: 12:00–18:59; boa noite: 19:00–04:59. O período fica fixo no trabalho, mesmo se atravessar um limite de horário.

As pausas e a prioridade das perguntas permanecem: entrada de 5–30 segundos conforme fila; pausas de apresentação de 18–30 segundos. Interrupção do cliente cancela mídias/preço ainda pendentes e mantém a regra de aguardar 60 segundos de silêncio para responder às perguntas na ordem recebida. Esses intervalos não são garantia de latência sob fila ilimitada. Nenhum trabalho antigo foi reiniciado ou reenviado.

Mensagem final, no formato solicitado pelo print, obtida do catálogo normal oficial:

```text
Estos son los valores normales de Vit Power:

• 1 frasco: USD 39.99
• 2 frascos: USD 70.00
• 3 frascos: USD 95.99
• 6 frascos: USD 167.99

¿Cuántos frascos desea?
```

Não foram acrescentadas promessas de brinde, tratamento ou condições comerciais fora dessa fonte.

## Continuação da negociação

O ensaio nativo identificou um segundo defeito antes da publicação: a pergunta da tabela não entrava na consulta de histórico com proprietário estrito, pois o espelho de saída antigo não grava esse campo. A proteção inferior identificava a pergunta repetida e bloqueava a resposta inteira.

A consulta mantém o proprietário oficial e aceita registros antigos sem proprietário somente com comprovante exato de ID do provedor e corpo, do mesmo contato/sessão e dentro de 24 horas. Trabalho B01 aceito e recibos SDR comprovados são as únicas fontes suplementares. Proprietário estrangeiro, telefone/sessão divergente, registro vencido ou sem comprovante continuam rejeitados. Guard, dedupe, lock e histórico não foram desligados. Metadados de recibo não são enviados como conteúdo ao modelo.

## Evidências

| Verificação | Resultado |
|---|---|
| Testes focados no candidato exato | # tests 346; # pass 346; # fail 0 |
| Senior completo | # tests 43; # pass 43; # fail 0; # tests 482; # pass 482; # fail 0; # tests 22; # pass 22; # fail 0; exit 0 |
| Gates extras e integridade negativa | 12 etapas PASS |
| Controlador de publicação | 40 verificações PASS |
| Aplicação HTTP isolada, Mongo tmpfs e SQLite descartável | 42 verificações PASS |
| Um áudio do período e tabela após frasco | PASS |
| Perguntas após tabela, preço repetido, dados/correção, confirmação e agradecimento | PASS; um pedido simulado de 3 frascos/USD 95.99 |
| Consulta de histórico em Mongo real isolado | PASS; aceita apenas recibos comprovados, rejeita identidades e registros indevidos |
| Tex Ultra herdado | Fontes idênticas ao parent; prova original vinculada por SHA; teste HTTP original em contexto privado adequado PASS |
| Arquivos comerciais protegidos | 33 com bytes preservados |
| VSL, painel, Nginx | Hashes e URLs conferidos sem edição por esta entrega |
| Recuperação antes/depois | Cópias opacas, descriptografia em RAM, hashes/metadados e adulteração rejeitada PASS |
| Produção | PM2 online, cwd/exec_path corretos, perfil/datas herdados, timer e Z-API conectada |

O modelo e a Z-API são simulados nesse ensaio; aplicação, persistência e relógio são reais em ambiente sem rede externa. Zero WhatsApp real, Dropi ou Meta enviados pela simulação. O teste físico do usuário comprovou o defeito do release anterior, não constitui prova física do novo. Nova execução física completa continua pendente; não foi aberta outra janela, removido histórico ou repetido B01 para forçar resultado.

## Preservação e falhas registradas

O delta contém dez arquivos aprovados, sem migração de banco: dois apontadores de boot, B01, runtime SDR, helper de histórico, quatro testes e contrato. Demais produtos, preços, pedido/recompra, humano/opt-out, transporte, Dropi, Pixel/CAPI, pós-venda, VSL e painel foram preservados. A atualização Tex publicada durante a preparação foi incorporada como parent; não foi sobrescrita.

Tentativas não publicadas foram mantidas: revisão de source rejeitou CRLF/delta; outra perdeu o parent por publicação concorrente; um teste Tex rodou inicialmente em contexto genérico incompatível e foi repetido sem alterar o teste, em PRIVATE_QA correto; o primeiro simulador reutilizava IDs do provedor e foi corrigido; o runner HTTP privado teve loopback desligado e store somente leitura em duas tentativas, corrigidos somente no namespace de teste; o ensaio seguinte comprovou a falha de histórico acima. Nenhum FAIL foi convertido em PASS por desativar proteção.

## Publicação e rollback

Código exato publicado em branch/tag próprios, sem mover production nem alterar o index local. Gates SHA vinculados e mutex de deploy; ativação apenas com fila/B01/lotes/locks sem trabalho. Um restart direcionado do Vitalismen; nenhum restart de Nginx/MongoDB. PID 3857145; cwd real `/opt/vitalismen-automacao/releases/20261117T205344Z_production-20261117-d35d58c`; pm_cwd `/opt/vitalismen-automacao/current`; pm_exec_path `/opt/vitalismen-automacao/current/src/index.js`. O timer permanece ativo e aponta ao controlador desta microcamada.

Cópias/provas: `C:\Users\Wolfe\Backups\VITALISMEN_EC\B01_PERIOD_PRICE_V243_R2\20261117`. Root `/opt/vitalismen-automacao/backups/b01-period-price-v243-r2-20261117`. Rollback documentado e não executado: `python3 -I -B -S /opt/vitalismen-automacao/backups/b01-period-price-v243-r2-20261117/operations-controller.py rollback`. Restaura o parent 4c47bb3, remove apenas o drop-in novo, conserva o executor anterior e verifica PM2/saúde. Exige parent e cadeia de boot retidos. Não restaura banco sobre dados vivos nem repete mensagens/pedidos/eventos.

Backup global MongoDB permanece FAIL por consistência. Recuperação de código/configuração é evidência separada; não equivale a restauração integral da VPS. Espaço livre reduzido permanece limitação operacional.
