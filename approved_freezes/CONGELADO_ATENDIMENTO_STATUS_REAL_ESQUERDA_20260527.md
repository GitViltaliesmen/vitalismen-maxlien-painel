# Congelado - Atendimento com status real na lista esquerda

Data: 2026-05-27

Arquivo base:
- `public/qr.html`

Hash SHA256 aprovado:
- `04ADDCFCCE682C305CC41EF73285AE2A63C6974A36BEF7E28385AE943FCC8F6A`

Escopo aprovado:
- A lista esquerda do Atendimento mostra o status operacional real do cliente.
- Status previstos: `Novo`, `Atendendo`, `Comprar depois`, `Confirmado`, `Pedido enviado`, `Entregue`, `Recompra`, `Cancelado`, `Devolvido`.
- O status e derivado de `orderStatus`, tags manuais existentes ou fallback seguro para `Novo`/`Atendendo`.
- O numero proprio conectado na Z-API permanece filtrado da lista de clientes.
- Sem alteracao em planilhas, banco de dados ou dados historicos.

Validacao local:
- `public/qr.html` respondeu em `http://127.0.0.1:3001/qr.html`.
- Sintaxe dos scripts inline validada com `node --check`.
- Rota `/api/whatsapp/chats?country=EC` validada com login local.
