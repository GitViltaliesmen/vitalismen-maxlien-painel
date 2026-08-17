# Fonte oficial GitHub, VPS e Windows

Atualizado em 2026-08-17.

## Fonte canonica

- GitHub: `https://github.com/GitViltaliesmen/vitalismen-maxlien-painel.git`.
- Branch implantavel: `production`.
- Windows oficial: `C:\Users\Wolfe\Documents\SITES\MAXLIENSHOP_JULHO_2026\Vitalismen Automacao`.
- VPS oficial: `/opt/vitalismen-automacao/current`.
- Dominio: `https://ec.maxlien.shop/`.

## Producao confirmada antes da V17

- Commit: `e0e2c548be9aeecf076fc5b5ec2a1405f0e0e0e0`.
- Tag anotada: `production-20260816-e0e2c54`.
- Release: `/opt/vitalismen-automacao/releases/20260817T022344Z_production-20260816-e0e2c54`.
- `production` no GitHub, tag resolvida e release ativa apontavam para o mesmo commit.

A V17 e descrita em `docs/PRODUCTION_SECURITY_PRODUCT_INTEGRITY_FREEZE_V17_20260817.md`. Enquanto a nova tag nao for ativada, o baseline acima continua sendo a producao e o rollback.

## Politica de release

1. Trabalhar somente a partir do HEAD remoto de `production`.
2. Exigir arvore limpa e testes/guards verdes.
3. Publicar `production` e uma tag anotada `production-AAAAMMDD-abcdef0` apontando para o mesmo commit.
4. Criar uma pasta nova e imutavel em `/opt/vitalismen-automacao/releases`; nunca sobrescrever release existente.
5. Copiar a `.env` oficial sem exibir segredos e executar os guards dentro da nova release.
6. Alterar `current` somente depois dos testes.
7. Reiniciar/recriar apenas `vitalismen-automation` e confirmar `pm_cwd` e `pm_exec_path` no release ativo.
8. Validar health, VSL, autenticação, PM2 e backlog por leitura.

O Git interno `/opt/git/vitalismen-automacao.git` e apenas espelho auxiliar. Se divergir, o GitHub oficial e a release ativa prevalecem; o espelho nao pode substituir silenciosamente a fonte canonica.
