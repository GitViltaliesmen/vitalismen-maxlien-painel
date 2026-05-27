# CONGELADO - Ficha do cliente status/acao aprovado

Data: 2026-05-27
Branch: `codex/leads-clientes-acoes-unificadas`
Arquivo principal: `public/qr.html`

## Estado aprovado

Modelo visual da `Ficha do cliente` aprovado pelo usuario em previa segura local:

`http://127.0.0.1:4181/qr.html`

## O que ficou congelado

- Bloco principal `Status e proxima acao` no topo da ficha.
- `Status` fica como fonte visual principal da ficha.
- Botao unico `Completar / confirmar`, com comportamento visual:
  - `Completar dados` quando faltam campos.
  - `Confirmar cliente` quando dados estao completos.
  - `Cliente ja confirmado` quando status ja esta confirmado/enviado/entregue/recompra.
- `Salvar ficha` preservado.
- `Enviar pedido Dropi` preservado.
- `Comprar depois` preservado.
- Campos logisticos preservados:
  - `customerCityInput`
  - `customerProvinceInput`
  - `customerAddressInput`
  - `agencySuggestions`

## Seguranca

- Nao houve deploy publico.
- Nenhuma planilha, banco, importacao ou cliente antigo foi alterado.
- Logica de busca/aplicacao de agencias nao foi removida.
- Antes de deploy, ainda testar agencia com cliente selecionado.

## Referencias

- Backup antes: `.codex_tmp/painel-ref-20260527-094321/qr.before.html`
- Plano: `PLANO_PAINEL_LEADS_CONEXOES_20260527.md`
