# Exportacao Meta compradores historicos

## Objetivo

Preparar as vendas confirmadas do dashboard EC que nao podem mais ser enviadas pela CAPI normal de `Purchase`, porque a Meta rejeita eventos de servidor com mais de 7 dias.

O script oficial e:

```text
scripts/export-meta-offline-purchases.mjs
```

## Comando

```sh
npm run meta:export:offline
```

## Arquivos gerados

O script grava os arquivos em:

```text
exports/meta/
```

Ele gera:

- `meta-offline-purchases-EC-*.csv`: compras historicas com evento, valor, data original e identificadores em SHA256.
- `meta-buyer-audience-EC-*.csv`: publico de compradores com telefone/nome/localizacao em SHA256.
- `meta-export-summary-EC-*.json`: resumo da exportacao.

## Seguranca

Os campos sensiveis saem hashados em SHA256:

- telefone;
- primeiro nome;
- sobrenome;
- cidade;
- provincia;
- pais;
- ID externo.

O arquivo nao deve misturar outro pais. Neste projeto oficial, `META_OFFLINE_COUNTRY` deve permanecer `EC`.

## Uso na Meta

Use primeiro o arquivo de eventos offline/dataset se a conta Meta permitir upload historico. Se essa opcao nao estiver disponivel, use o arquivo de publico para criar uma audiencia de compradores e alimentar campanhas/lookalike.
