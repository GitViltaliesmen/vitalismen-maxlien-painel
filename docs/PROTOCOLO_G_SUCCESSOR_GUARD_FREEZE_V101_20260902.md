# Congelamento V101 — composição sucessora dos guards V61–V63

Data: 2026-09-02

## Objetivo

Fazer os guards diretos V61, V62 e V63 reconhecerem os hashes atuais já
autorizados e congelados pelas sucessoras V90 e V98, sem flexibilizar a
comparação para arquivos ou hashes não declarados.

## Contrato congelado

- Cada guard lê os manifestos canônicos V90 e V98.
- Uma divergência ancestral só é aceita quando o caminho consta em
  `declaredAncestorOverrides` e o hash atual coincide exatamente com
  `protectedFiles` do manifesto sucessor correspondente.
- Os hashes históricos V61–V63 não são regravados.
- O senior guard admite a citação da origem somente nos dois serviços V101;
  todos os demais arquivos continuam bloqueados pela regra geral.
- A rota Z-API e todo o comportamento operacional permanecem byte-intactos.
- Nenhuma flag, mensagem, pedido, remessa, submissão Dropi, evento Meta,
  preço, produto, banco ou scheduler é alterado.

## Validação obrigatória

```sh
node scripts/guard-protocolo-g-successor-v101.mjs
node --test tests/protocolo-g-successor-guard-v101.test.mjs
npm run guard:protocolo-g-conversion-v62
npm run guard:protocolo-g-ad-metrics-v63
npm run guard:meta-ec-protocolo-g-v61
```

O manifesto canônico está em
`docs/freeze/protocolo-g-successor-guard-v101-20260902.json`.
