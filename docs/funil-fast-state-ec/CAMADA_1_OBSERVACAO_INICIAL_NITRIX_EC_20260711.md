# Camada 1 — Observação inicial Nitrix EC

Data do registro: 2026-07-12T01:03:33Z (2026-07-11, America/Sao_Paulo)
Escopo: somente leitura; nenhum contato recebeu mensagem por causa desta auditoria.

## Base congelada

- Runtime ativo: `/opt/vitalismen-automacao/releases/20260711233201_git_d861889`.
- Commit de código em execução: `d861889c3933bc4808c339e628ef7ec4e4a722f6`.
- Repositórios local, GitHub e bare repository VPS: `2fdf739634dbde4a01e3b8433f0ed203712b101f`.
  Esse commit é documental; por isso o release executável permanece intencionalmente em `d861889`.
- Fast State Nitrix EC: habilitado, modo explícito `full`, sem telefone de QA configurado.
- PM2 `vitalismen-automation`: `online`, sem reinício desde a ativação do release.
- Saúde em `127.0.0.1:3001/api/health`: `online`, sem motivos de degradação, WhatsApp pronto, Z-API conectada (linha terminada em `2800`) e fila inbound sem pendências.

## Janela observada

Início da liberação: `2026-07-11T23:32:23Z`.
Coleta: `2026-07-12T01:03:33Z`.

Agregados sem telefone, nome ou conteúdo de mensagem:

| Indicador Nitrix Fast State | Resultado |
| --- | ---: |
| Contact States Nitrix criados/atualizados após a liberação | 0 |
| Jobs de cadência pendentes | 0 |
| Handoffs manuais acionados pelo Fast State | 0 |
| Interrupções por resposta de cliente | 0 |
| Falhas/retries do Fast State | 0 |

Conclusão: ainda não entrou uma origem VSL Nitrix comprovada depois da liberação. Portanto não há evidência de envio, interrupção ou atendimento real para aprovar/reprovar nesta janela — e também não há sinal de comportamento indevido.

## Observadores passivos

- Observador passivo geral EC: 9 mensagens / 3 conversas na janela própria; `0` alertas, `0` pendências sem resposta. Ele não enviou mensagens nem modificou contatos.
- Observador de “funil perfeito”: traz 25 achados heurísticos sobre 9 atendimentos históricos na janela de 24 horas. Ele usa regras e memória `vit_power_ec`; portanto não é atribuído ao Nitrix nem pode bloquear esta camada. A separação produto-neutra desse observador pertence à futura Camada 5, sem copiar conteúdos, preços ou áudios entre produtos.

## Regra até a próxima leitura

1. Manter Nitrix em `full` exclusivamente para entradas VSL Nitrix comprovadas.
2. Não disparar teste manual nem reencaminhar cliente antigo para “gerar evidência”.
3. Na primeira entrada real, conferir apenas os agregados: início, jobs enviados, eventual resposta/interrupção, falha/handoff e fila.
4. Fechar a observação com dados após 10 entradas reais ou 24 horas de tráfego, o que ocorrer primeiro. Se houver falha, preservar o Contact State para análise e assumir atendimento humano; não repetir mídia nem misturar Vit Power.

## Limites desta camada

Esta camada não altera preços, textos, áudios, saúde, Dropi, Meta, painel ou roteamento. O Dropi continua como camada independente, bloqueada até a sessão/2FA e um pedido controlado escolhido pelo operador.
