# Congelamento V91 — contexto sucessor dos guards de deploy

## Objetivo único

Corrigir a ordem de inicialização da cadeia histórica V71–V77H2 durante o stage.
O helper passa um preload absoluto e vinculado à própria candidata somente aos
subprocessos `npm` que executam guards e testes. Assim, o V73 recebe as exceções
de ancestralidade já declaradas e protegidas pelo V78 antes de comparar hashes.

## Causa confirmada

O arquivo `scripts/guard-meta-ec-protocolo-g-attribution-v61.mjs` possui o hash
legítimo declarado pelo V78, mas o stage chamava `guard:runtime-chain-v71` sem o
contexto sucessor. O V73 era executado primeiro e comparava esse arquivo com seu
hash ancestral, encerrando o stage antes de o V78 declarar a sucessão.

Depois de instalar o contexto, o V77H2 também revelou uma asserção isolada do
hash do helper fora de `successorOverrides`. Essa única condição foi alinhada ao
mesmo mecanismo fail-closed que o próprio V77H2 já usa para os demais arquivos.

## Microcorreção

- nenhum hash ancestral foi reescrito;
- nenhum guard foi desativado ou ignorado;
- o V77H2 só aceita o helper sucessor quando o caminho estiver declarado pelo
  manifesto V91 já validado;
- o predeploy histórico é materializado pelo runner V91, que executa a cadeia
  runtime ancestral V71–V77H2 sob os guards sucessores V78–V91;
- o preload é absoluto, pertence à candidata e falha fechado se estiver ausente;
- a variável é passada somente aos comandos `npm` protegidos do helper;
- `npm ci`, execução normal do processo e PM2 não recebem esse preload V91.

## Preservado

Não foram alterados VSL móvel, página informativa desktop, Pixel/Dataset, CTA,
banco, Z-API, mensagens, funil, Dropi, schedulers, preços ou qualquer componente
da Colômbia. Os hashes congelados das páginas externas continuam:

- desktop: `ddf1a65ff3696a10ce7105523397592a85566cb837447210eecb100d3953cf27`;
- celular: `59b1d47e1c9d7613d1fc30884ce7df78080f9544c730e9435079a0aa39bdfe7b`.

## Validação obrigatória

```sh
node scripts/guard-deploy-guard-ancestry-v91.mjs
node --test tests/deploy-guard-ancestry-v91.test.mjs
npm_config_node_options="--import=file://$PWD/scripts/lib/deploy-guard-ancestry-v91-successor-context.mjs" npm run guard:runtime-chain-v71
```
