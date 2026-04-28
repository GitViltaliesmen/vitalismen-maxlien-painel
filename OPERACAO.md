# Operacao do Painel Maxlien

Guia curto para usar o painel no dia a dia sem perder leads, agenda ou backup.

## Horario recomendado

- Operacao ativa: `09:00` ate `18:00`.
- Primeira revisao de agendados: `09:00`.
- Segunda revisao de agendados: `16:30`.
- Exportacao/backup final: fim do expediente, antes de fechar o navegador.

## Quem usa

- Um operador principal por navegador/dispositivo.
- Um responsavel de fechamento para conferir agendados, confirmados e backup.
- Evitar varios operadores editando a mesma lista em navegadores diferentes, porque a versao atual salva os dados no `localStorage` do proprio navegador.

## Rotina de inicio do dia

1. Abrir `https://painel.maxlien.shop/`.
2. Conferir se o filtro esta em `Todos`.
3. Clicar em `agenda de hoje`.
4. Revisar leads `agendado` e atrasados.
5. Voltar para `todos` e iniciar atendimento dos novos leads.

## Rotina durante o dia

- Usar `novo` para lead que ainda nao recebeu atendimento.
- Usar `pendente` quando faltar dado do cliente.
- Usar `atendendo` quando houver conversa aberta.
- Usar `processado` quando o lead ja foi tratado e aguarda proxima etapa.
- Usar `agendado` quando o cliente pediu compra futura; preencher sempre `data desejada`.
- Usar `retirada_agencia` quando o cliente precisa retirar em agencia.
- Usar `confirmado` quando o pedido estiver pronto para seguir.
- Usar `entregue` quando a entrega estiver finalizada.
- Usar `cancelado` somente quando o cliente desistiu ou o pedido nao deve seguir.
- Usar `devolvido` quando houve retorno/devolucao.

## Rotina de fim do dia

1. Filtrar `agenda de hoje` e resolver pendencias urgentes.
2. Conferir `pendente`, `atendendo` e `agendado`.
3. Exportar leads em `.json`.
4. Guardar o arquivo exportado em uma pasta de backup com a data do dia.
5. Registrar qualquer problema operacional antes de fechar.

## Backup

- Fazer backup `.json` todos os dias no fim do expediente.
- Nome sugerido da pasta: `Backups Painel Maxlien`.
- Manter os arquivos por data, exemplo: `maxlien-leads-2026-04-28.json`.
- Antes de limpar navegador, trocar de computador ou restaurar demo, exportar um backup.

## Cuidados

- O painel atual e estatico e salva dados no navegador.
- Se outro computador abrir o painel, ele nao ve automaticamente os mesmos leads.
- Para producao com varios operadores, o proximo passo tecnico e criar backend compartilhado com login.
- `restaurar demo` apaga os leads salvos naquele navegador; usar apenas depois de exportar backup.
