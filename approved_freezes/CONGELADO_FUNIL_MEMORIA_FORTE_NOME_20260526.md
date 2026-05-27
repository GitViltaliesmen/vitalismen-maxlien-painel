# Congelado - Funil memoria forte do nome

Data: 2026-05-26

Objetivo:

- Impedir que o funil perca o nome do cliente durante etapas de quantidade, agencia e confirmacao.
- Evitar que respostas curtas de agencia/confirmacao sejam salvas como nome.
- Reduzir risco de fluxos antigos sobrescreverem o funil SDR atual.

Correcoes publicadas:

- `mergeCheckoutOrderData` preserva nome anterior confiavel quando uma entrada nova nao contem nome valido.
- `principalSdrSaveMemory` agora escolhe nome confiavel entre:
  - pedido atual
  - `conversationState`
  - `pendingCheckoutOrder`
  - `metadata.customerDraft`
- Se o nome atual nao for confiavel, ele nao e mantido na memoria.
- `principalSdrMergeIncoming` nao permite que respostas de local/agencia/confirmacao virem nome.
- Varredura de banco executada para nomes contaminados como `sirve esa`, `si sirve`, `confirma esa`; nenhum registro contaminado encontrado no momento da publicacao.
- Numero piloto `5515998038637` liberado apos publicacao.

Arquivo alterado:

- `src/services/conversationEngine.js`

Processo reiniciado:

- `vitalismen-automation`
