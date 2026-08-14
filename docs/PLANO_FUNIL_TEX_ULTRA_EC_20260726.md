# Plano operacional Tex Ultra / Dropi EC — 2026-07-26

## Decisao aprovada

- A VSL publica atual `https://ec.maxlien.shop/n/` passa a atribuir os novos contatos ao produto `tex_ultra_ec`.
- Cada VSL mantem sua atribuicao propria: `/n/` para Tex Ultra, `/m/` para Vit Power e entradas Nitrix explicitamente identificadas para Nitrix.
- A oferta usa frascos:
  - 1 frasco: USD 35.99;
  - 2 frascos: USD 70.00;
  - 3 frascos: USD 80.99;
  - 6 frascos: USD 147.99.
- Nitrix Oxide, Vit Power e Tex Ultra permanecem selecionaveis no painel antes do envio.
- A troca manual no painel altera somente o produto da ficha/pedido atual. A origem da VSL continua registrada para auditoria e nenhuma outra VSL e modificada.
- Produto e preco podem ser alterados enquanto o pedido estiver em rascunho, pendente ou confirmado e ainda nao tiver sido submetido.
- O envio real continua exigindo autorizacao e clique separados. Nunca enviar automaticamente apenas pela selecao.

## Catalogo Dropi validado

- Nitrix / Nitric Oxide: ID 105825.
- Tex Ultra 120 Cap Energia: ID 110681.
- Vit Power / Vit Powerss 1000 ML X1 Comunidad: ID 103743.

A validacao foi somente leitura. Nenhum pedido real foi criado durante a conferencia.

## Fluxo operacional pronto

1. Entrada da VSL cria o contato com `productKey=tex_ultra_ec` e tabela `promotional`.
2. A Ficha do Cliente e Leads Clientes permitem escolher Tex Ultra, Nitrix ou Vit Power.
3. O operador escolhe tabela e quantidade, salva e pode corrigir antes do envio.
4. O servidor grava um marcador de produto/preco no lead e no pedido operacional.
5. A autorizacao Dropi e separada do envio real.
6. O payload conserva produto, quantidade, total com centavos, cidade, provincia e entrega Servientrega.
7. Depois do envio, permanecem as rotinas existentes de guia, status de transporte, lembrete de retirada e recompra.
8. Pedido devolvido, cancelado, bloqueado ou ja enviado nao pode ser alterado/reutilizado.

## Trava de seguranca comercial

Tex Ultra permanece em atendimento comercial manual ate existirem materiais proprios aprovados. O sistema nao pode reutilizar automaticamente:

- audios de Nitrix ou Vit Power;
- imagem de frasco de outro produto;
- provas sociais de outro produto;
- instrucoes medicas, garantia ou promessa de resultado nao aprovadas.

Essa trava nao impede preparar, autorizar e enviar o pedido correto ao Dropi pelo painel.

## Materiais ainda necessarios para automatizar a venda Tex Ultra

1. Foto oficial do produto para WhatsApp.
2. Texto curto de apresentacao aprovado.
3. Orientacao de uso aprovada pelo fornecedor.
4. Regras de garantia e contraindicacoes aprovadas.
5. Audios da Valeria especificos para abertura, precos e confirmacao.
6. Provas sociais autorizadas especificamente para Tex Ultra.
7. Texto final de confirmacao do pedido e consentimento para os avisos.

Depois de receber esses materiais, criar um Fast State Tex Ultra isolado, com memoria persistente e testes anti-duplicidade, sem reaproveitar o motor de outro produto.
