# Fonte oficial GitHub, VPS e Windows

Data da consolidacao: 2026-08-16

## Repositorio canonico

- GitHub: `GitViltaliesmen/vitalismen-maxlien-painel`
- Windows: `C:\Users\Wolfe\Documents\SITES\MAXLIENSHOP_JULHO_2026\Vitalismen Automacao`
- VPS: `/opt/vitalismen-automacao/current`

O nome historico do repositorio menciona apenas painel, mas as branches operacionais
contem backend, painel, WhatsApp, Dropi Ecuador, Meta, extensao e testes.

## Referencias consolidadas

- `production`: commit `dbe5f3af960cb0b48009ac81736b552d54e910b5`, igual a release ativa auditada no VPS.
- `staging`: commit `a19c2711bc28ba9ddffc04b0c226c1e42a342071`, V15 local testada e ainda nao publicada.
- tag da producao auditada: `production-20260815-dbe5f3a`.
- branch de preservacao V15: `codex/customer-data-intelligence-v15-20260815`.

As referencias acima foram criadas primeiro no repositorio local. A publicacao no GitHub,
a troca da branch padrao e qualquer deploy continuam exigindo autorizacao separada.

## Regras obrigatorias

1. O GitHub e a fonte de verdade do codigo.
2. `production` deve sempre apontar para o commit implantado no VPS.
3. `staging` recebe apenas versoes testadas e ainda nao implantadas.
4. O deploy aceita somente arvore Git limpa, branch `production` e tag no formato `production-AAAAMMDD-abcdef0`.
5. Branch e tag precisam existir no GitHub e apontar para o mesmo commit local.
6. A arvore enviada ao VPS e extraida com `git archive`; arquivos locais ignorados ou nao commitados nao entram na release.
7. Cada release recebe `.release-source.json` com repositorio, branch, tag e commit.
8. Uma pasta de release existente nunca pode ser sobrescrita.
9. A ativacao do symlink `current` e o restart do processo continuam sendo decisoes separadas.

## Fluxo de promocao

```text
feature/* -> staging -> testes -> production -> tag production-* -> release VPS
```

Nunca fazer deploy diretamente de `feature/*`, `codex/*`, `main` legado ou de uma
arvore com alteracoes locais.

## Legado

A branch `main` observada durante a auditoria aponta para o painel estatico antigo
`aaa8e06711fb7c9e0751522e2808d0d62452d3de`. Ela nao representa a automacao em
producao e deve ser preservada como legado antes de uma futura troca da branch padrao.

## Bloqueios antes de promover a V15

- A credencial local antiga foi removida do JavaScript; antes da promocao, rotacionar ou excluir no banco qualquer conta de teste equivalente.
- Confirmar a URI do MongoDB no ambiente de destino e executar o health check sem `ECONNREFUSED 127.0.0.1:27017`.
- Publicar `production`, `staging` e a tag de producao no GitHub oficial antes de tentar qualquer deploy novo.
- Tornar `production` a branch padrao e protegida somente depois de preservar a `main` antiga como legado.
