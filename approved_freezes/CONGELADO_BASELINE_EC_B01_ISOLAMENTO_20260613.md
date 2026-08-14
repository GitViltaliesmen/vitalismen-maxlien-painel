# Congelado - Baseline EC B01 Isolamento

Data: 2026-06-13.
Hora de referencia do painel: 00:26:08 America/Sao_Paulo.
Status: checkpoint local salvo para continuidade segura.

## Objetivo

Preservar a versao local do projeto Vitalismen Automacao usada nos testes finais do Equador, com painel integrado, Funil rapido, bloco B01, Leads Clientes separado e camadas de isolamento por pais em andamento.

## Escopo congelado

- Projeto oficial local: `/Users/greson/Documents/Vitalismen Automacao`.
- Painel local testado: `http://127.0.0.1:3001/qr.html`.
- Arquivo principal do painel: `public/qr.html`.
- Hora do arquivo `public/qr.html`: 2026-06-13 00:26:08 -03.
- Leads Clientes separado: `public/leads-window.html`.
- Baseline documentada: `docs/BASELINE_EC_INTEGRADA_2026-06-12.md`.

## Estado encontrado

- `senior:check`: OK local.
- API local: `/health` OK.
- WhatsApp local: sessao default conectada `553183002800`.
- B01 existe no Funil rapido.
- Para EC, B01 e `Inicio completo`: Inicio 01 + Inicio 02 + Prova 1 + Frasco Vit Power.
- Para CO, B01 ainda troca para `Frasco FrascoEspecial` quando o contexto/pais e CO.

## Pendencias antes de chamar de isolamento final

1. Travar o Funil rapido/B01 para Equador neste projeto ou remover/ocultar o caminho CO desta frente.
2. Alinhar guards antigos com a tela separada `leads-window.html?country=EC`.
3. Garantir que o envio Dropi continue exigindo autorizacao manual segura antes de qualquer envio real.
4. Confirmar flags oficiais no VPS antes de publicar.
5. Resolver o aviso de formulario recente sem pedido EC correspondente, se ainda existir na auditoria.

## Backup externo

Foi criado backup local compactado sem `.env`, sessoes WhatsApp, `node_modules`, `.local`, logs e temporarios:

```text
/Users/greson/Documents/Vitalismen-freezes/freeze-ec-b01-isolamento-20260613-002608.tar.gz
```

## Regra de retomada

Retomar deste ponto antes de novas alteracoes no isolamento EC/CO. Nao reverter para uma copia antiga do painel sem comparar contra esta baseline.
