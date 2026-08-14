# Congelamento aprovado Tex Ultra EC v4

Data: 2026-08-03

## Escopo imutavel

Ficam aprovadas e congeladas como uma unica unidade operacional:

1. a camada inicial Tex Ultra EC, com sua ordem, tempos cumulativos, fila por leva, memoria persistente e pausa imediata quando o cliente interage;
2. a microcamada automatica posterior a confirmacao, com envio serial e unico de `AGRADECIMENTO_AGENCIA_DE_ENTREGA` seguido de `BONUS_RETIRADA`;
3. os locks persistentes por pedido, a verificacao de historico, `sentAt`, lote 1, intervalo de 60 segundos, isolamento `tex_ultra_ec` e protecao de contatos ja atendidos manualmente;
4. a pausa segura de cadencias orfas no startup, sem reconstruir timers nem reenviar depois de deploy/reinicio.

## Evidencia de producao

O pedido `EC-MSCNC7NL-EQGQ` recebeu exatamente os dois audios aprovados. Os IDs Z-API `C3BDC37B21CA096C1F5A` e `3EB04B1870F5D08F2BB896` foram persistidos e ficaram com status `delivered`. Ciclos posteriores da fila mantiveram somente duas mensagens.

## Protecao contra acidente

- O manifesto `docs/freeze/tex-ultra-approved-v4-20260803.json` registra hashes SHA-256 dos servicos e audios aprovados.
- `scripts/guard-tex-ultra-approved-v4.mjs` falha imediatamente se qualquer byte protegido mudar.
- `senior:check`, `deploy:ec-safe` e `deploy:vps` executam esse guard antes de continuar.
- O processo executa `texUltraApprovedFreezeRuntimeGuard` antes de carregar a API; hash divergente ou manifesto ausente no ambiente oficial bloqueia o startup.
- A publicacao oficial cria snapshot aprovado fora do ponteiro mutavel de releases e aplica protecao somente leitura/imutavel aos arquivos congelados quando suportada pelo filesystem.
- Qualquer mudanca futura exige autorizacao escrita do operador e um novo congelamento versionado. Este v4 nunca deve ser editado para acomodar uma alteracao.

## Rollback aprovado

O rollback desta camada deve apontar para o snapshot aprovado v4, nunca para uma release intermediaria que nao contenha os dois guardas, os dois audios e os locks persistentes.
