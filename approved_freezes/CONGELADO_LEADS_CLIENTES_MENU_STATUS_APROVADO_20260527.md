# CONGELADO - Leads Clientes menu/status aprovado

Data: 2026-05-27
Branch: `codex/leads-clientes-acoes-unificadas`
Arquivo principal: `public/leads-window.html`

## Estado aprovado

Tela `Leads Clientes` aprovada visualmente pelo usuario em previa segura local:

`http://127.0.0.1:4181/leads-window.html?country=EC`

## O que ficou congelado

- Ordem das colunas:
  `ID`, `Telefone`, `Nome`, `Endereco`, `Cidade`, `Provincia`, `Qtd`, `Valor`, `Status`.
- `Status` fica no canto direito junto ao menu `...`.
- Acoes ficam no menu:
  - `Completar dados` quando falta pouco.
  - `Confirmar cliente` quando ja esta completo, mas ainda nao confirmado.
  - `Marcar Dropi` para envio em lote.
  - `Enviar para Dropi`.
  - `Dropi enviado` como informacao.
  - `Abandono 12h` como acao humana para voltar a `atendendo`.
  - `Editar`.
  - `Excluir` visual, bloqueado ate existir backup/trava e rota segura.
- Status oficiais preservados:
  `novo`, `atendendo`, `comprar_depois`, `confirmado`, `pedido_enviado`, `entregue`, `recompra`, `cancelado`, `devolvido`.
- `abandono` nao virou status oficial.
- Fonte da tabela aumentada moderadamente.
- Largura do status padronizada automaticamente pelo maior rotulo.

## Seguranca

- Nao houve deploy publico.
- Nenhuma planilha, banco, importacao ou cliente antigo foi alterado.
- Previa segura permitiu leitura real e bloqueou escrita.
- Exclusao real nao foi ativada.

## Referencias

- Backup antes: `.codex_tmp/painel-ref-20260527-094321/leads-window.before.html`
- Plano: `PLANO_PAINEL_LEADS_CONEXOES_20260527.md`
- Screenshot aprovado: `.codex_tmp/painel-ref-20260527-094321/screenshots-local-after/leads-clientes-status-largest-standard.png`
