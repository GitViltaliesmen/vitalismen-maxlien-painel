# Freeze V55 — persistência integral da ficha do cliente EC

Data: 2026-08-24
País: Equador
Pai: `tex-ultra-delivery-closure-v54-20260824`

## Incidentes confirmados

- No caso final `4663`, a agência estava verificada e preservada no
  `ContactState`, mas o preview V54 devolvia endereço vazio por tratar endereço
  de agência como `NOT_APPLICABLE`. O painel copiava esse vazio para o pedido.
- A mesma sequência atingiu exatamente mais um pedido de agência, final `1150`.
  A varredura somente leitura examinou 199 pedidos EC e 856 estados EC; não
  encontrou outro pedido de agência com endereço vazio nem outro rascunho de
  agência sem endereço canônico.
- Durante a digitação, `applyCustomerDraftToChat` substituía `chat.phone` pelo
  valor do campo editável. A chave do cache mudava no meio da edição e uma
  recarga periódica podia reidratar valores vazios, parciais ou de outro contato.
- A API autenticada também aceitava telefone divergente e podia transformar o
  rascunho de uma ficha na identidade de outra conversa.
- A varredura achou uma divergência histórica adicional: a conversa final
  `5541` guardava o rascunho do final `4364`. A evidência explícita da própria
  conversa identifica nome, telefone, cidade e agência do final `5541`.

## Correções autorizadas

- O endereço de retirada exibido e persistido pelo painel é materializado a
  partir do ID, nome e endereço verificados em `src/data/agencia_LISTA.json`.
  A evidência bruta do cliente continua separada no motor V28/V54.
- `chat.phone`, `phoneDigits`, `lastSenderPn` e o identificador real da conversa
  têm prioridade sobre qualquer rascunho editável. Digitação parcial ou campo
  vazio não muda a chave do cache.
- Formatação equivalente do telefone é normalizada para a conversa atual.
  Número realmente diferente é rejeitado no navegador e na API com mensagem
  explícita, sem apagar os demais campos.
- `realPhoneFromState` consulta remetente e estado antes do rascunho, impedindo
  que dados já contaminados assumam a identidade da conversa.
- O reparo V55 é limitado aos pedidos `EC-MT6GO9YX-4QS9` e
  `EC-MT6GWGA2-9ZUZ` e ao `ContactState` exato da conversa final `5541`.
  Exige confirmação literal, backup absoluto e pré-condições de ID/telefone.

## Proteções preservadas

- O pedido entregue historicamente associado às mensagens do final `5541` não
  é alterado; o reparo apenas separa a ficha atual do rascunho de outro cliente.
- Nenhuma mensagem ou mídia histórica é removida, reclassificada ou reenviada.
- Status, quantidade, total, Purchase Meta e Dropi existentes dos pedidos 4663
  e 1150 permanecem intactos. O pedido 1150 conserva o Dropi já existente.
- Nenhum WhatsApp, Meta/CAPI ou Dropi é disparado pelo reparo ou pelos testes.
- Produtos, preços, VSL, checkout, pixel, Z-API, número oficial, áudio, imagem,
  funil, pós-venda e scheduler não são alterados.
- Nenhum cliente real é usado como canário de implantação.

## Validação obrigatória

- `npm run guard:panel-customer-form-v55`
- `npm run guard:ec-product-micro-layer`
- `npm run guard:guide-print-spam`
- `npm run senior:check`
- `npm test`
- dry-run V55 no staging e produção antes de `--apply`
- após ativação: `pm2 jlist`, `readlink -f /opt/vitalismen-automacao/current`,
  health local/público, `/n/` e estado Z-API somente leitura.
- após o reparo: repetir a varredura dos 199 pedidos/856 estados e confirmar
  zero mensagens, Purchase ou submissões Dropi novas.

O rollback reativa a release V54 e restaura somente os documentos incluídos no
backup V55, preservando bancos, mensagens, mídias, pedidos e Shipments alheios.
