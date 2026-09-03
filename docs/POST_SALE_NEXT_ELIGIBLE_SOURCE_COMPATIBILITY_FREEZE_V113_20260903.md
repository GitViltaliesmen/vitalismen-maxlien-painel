# Congelamento V113 — compatibilidade de identidade do monitor pós-venda

Data: 2026-09-03
Escopo: Vitalismen Ecuador, VPS Hostinger oficial, `ec.maxlien.shop`.

## Problema comprovado

O monitor V112 foi publicado e ativado como código aditivo, mas seu helper
`source_identity` exigia a chave legada `tree` em `.release-source.json`. Releases
modernas V70 registram a identidade equivalente em `functionalTree`. A tentativa
de armar o monitor falharia antes de qualquer leitura de pedidos ou chamada de
provedor.

## Microcamada autorizada

V113 adiciona somente um adaptador de leitura em memória. Ao ler exatamente um
arquivo chamado `.release-source.json`, e somente quando `tree` estiver ausente e
`functionalTree` for um SHA-1 hexadecimal válido de 40 caracteres, o adaptador
expõe `tree = functionalTree` ao processo filho. O arquivo oficial não é escrito,
renomeado nem reformatado.

O wrapper V113 delega `check`, `arm` e `run` ao controlador V112 congelado com o
adaptador carregado. A instalação usa unidades systemd próprias V113 para que o
mesmo contrato seja aplicado em toda execução agendada.

## Preservado

- bot de vendas V78 e funil comercial;
- produto, preço, checkout, Z-API, Dropi e Meta/CAPI;
- banco, pedidos, ledger e memória de clientes;
- critérios, limites, idempotência, anti-spam e lote único do V112/V105;
- pós-venda desligado enquanto não houver evento natural elegível;
- backlog histórico, Dropi automático e Meta retroativo desligados.

## Travas

- nenhuma gravação em `.release-source.json`;
- nenhuma adaptação quando `tree` já existe;
- nenhuma adaptação para árvore inválida;
- monitor detector continua com zero chamadas de provedor e zero mutações Mongo;
- `batchMax=1`, `dailyLimit=1` e promoção além de um continuam proibidos.

## Rollback

Desabilitar `vitalismen-postsale-next-eligible-v113.timer` e remover somente as
duas unidades V113 instaladas. O V112 e o bot de vendas permanecem preservados.
