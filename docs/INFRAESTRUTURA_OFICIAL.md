# Infraestrutura oficial — MAXLIEN EC / Vitalismen

Data da consolidacao operacional: 2026-08-16

Este documento e o ponto de entrada para localizar o projeto oficial com seguranca.
Ele nao autoriza deploy, alteracao de producao ou operacao sobre clientes.

## Identidade oficial

- Projeto: `MAXLIEN EC — VITALISMEN OFICIAL`
- Raiz Windows: `C:\Users\Wolfe\Documents\SITES\MAXLIENSHOP_JULHO_2026\Vitalismen Automacao`
- Marcador obrigatorio: `.vitalismen-official-root`
- GitHub oficial: `GitViltaliesmen/vitalismen-maxlien-painel`
- Alias SSH do GitHub: `github-vitalismen-ec`
- Alias SSH de acesso somente leitura ao VPS: `maxlien-vps`
- Git interno do VPS: `/opt/git/vitalismen-automacao.git`
- Caminho da producao: `/opt/vitalismen-automacao/current`
- Branch operacional consolidada: `codex/source-of-truth-hardening-20260816`
- Baseline operacional preservado: `44504f2a503b4beef5ff4c5b0a0d8a34548c46e3`

O nome historico do repositorio menciona `painel`, mas a linha oficial contem backend,
painel, extensao, integracoes Ecuador, documentacao e testes.

## Estado conhecido da producao

Release ativa auditada:

```text
/opt/vitalismen-automacao/releases/20260815T153200Z_ec_manual_product_lead_badge_v12_dbe5f3a
```

HEAD da producao:

```text
dbe5f3af960cb0b48009ac81736b552d54e910b5
```

O symlink deve resolver assim enquanto nenhuma nova producao for autorizada:

```text
/opt/vitalismen-automacao/current
  -> /opt/vitalismen-automacao/releases/20260815T153200Z_ec_manual_product_lead_badge_v12_dbe5f3a
```

Qualquer release ou HEAD diferente deve gerar alerta e interromper o inicio automatico
do trabalho ate que a mudanca seja auditada e esta documentacao seja atualizada.

## Producao, V15 e linha operacional

```text
producao VPS
dbe5f3af960cb0b48009ac81736b552d54e910b5
  |
  v
V13
f8734e87b6f75a4c97c4988bf495d2ac09bc1c87
  |
  v
V14
e479ab61701619c35153d61063585cb4d92919a6
  |
  v
V15 congelada e preservada no GitHub
a19c2711bc28ba9ddffc04b0c226c1e42a342071
  |
  v
hardening da fonte de release
c62be2cfcc6eea1c66cdde4347d2d1fa3ea54659
  |
  v
baseline operacional preservado no GitHub
44504f2a503b4beef5ff4c5b0a0d8a34548c46e3
```

Interpretacao:

- `dbe5f3a` e o codigo atualmente implantado no VPS;
- `a19c271` congela a V15 e inclui V13 e V14 como ancestrais;
- `44504f2` inclui V15 e os hardenings posteriores;
- commits puramente documentais/operacionais podem aparecer depois de `44504f2`
  sem significar que a producao mudou;
- somente o HEAD lido em `/opt/vitalismen-automacao/current` determina a producao ativa.

## Remotes Git

### `origin`

Repositorio canonico no GitHub:

```text
git@github-vitalismen-ec:GitViltaliesmen/vitalismen-maxlien-painel.git
```

Use `origin` para preservacao oficial somente quando houver autorizacao explicita.
Push para uma branch nao e deploy.

### `fork`

Repositorio auxiliar nao canonico:

```text
https://github.com/SempreBelaERadiante/vitalismen-maxlien-painel-1.git
```

Nao usar como fonte de verdade, nao sincronizar automaticamente e nao misturar com a
linha oficial sem autorizacao escrita citando esse remote.

### `vps`

Repositorio Git bare interno:

```text
maxlien-vps-ec:/opt/git/vitalismen-automacao.git
```

O remote `vps` nao e o diretorio em execucao. O codigo em producao continua sendo o
symlink `/opt/vitalismen-automacao/current`. Nao enviar refs ao `vps` nem ativar release
sem autorizacao especifica de publicacao.

## Branches e legado

- Branch operacional: `codex/source-of-truth-hardening-20260816`.
- Branch de preservacao V15: `codex/customer-data-intelligence-v15-20260815`.
- `staging` local: `44504f2a503b4beef5ff4c5b0a0d8a34548c46e3`.
- `staging` nao foi publicada remotamente.
- `production` local: `dbe5f3af960cb0b48009ac81736b552d54e910b5`.
- `production` nao foi publicada como branch remota.
- `main` e legado estatico e nao representa a automacao oficial em producao.
- `main` observada no GitHub: `aaa8e06711fb7c9e0751522e2808d0d62452d3de`.

Nunca iniciar trabalho funcional em `main`, nunca fazer merge automatico e nunca mover
`production` ou `staging` sem uma tarefa explicita de promocao.

## Entrada segura em um clique

Na raiz oficial, execute:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-codex-work.ps1
```

Para executar apenas o diagnostico:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\codex-status.ps1
```

O diagnostico e somente leitura. Ele nao executa `fetch`, `pull`, `push`, merge,
checkout, deploy, restart, escrita no VPS ou alteracao de configuracao Git.

`AMBIENTE PRONTO PARA TRABALHO` aparece somente quando os gates basicos nao encontram
risco critico. Um alerta deve ser investigado; nao contornar o script para continuar.

## Isolamento permanente

Use somente esta raiz para o projeto Vitalismen Ecuador. Nao abrir, comparar, testar,
copiar, empacotar, publicar ou usar como referencia:

- projetos de Colombia;
- Contabo ou Maxtourus;
- automacoes de aquecimento separadas;
- pastas `New project*`;
- zips, copias antigas ou diretorios temporarios;
- outros GitHub, VPS, dominios, bancos, numeros, pixels ou funis.

Qualquer excecao exige pedido explicito do operador citando exatamente a origem externa.

## Segredos

Este documento registra apenas nomes publicos, aliases e caminhos operacionais. Nunca
adicionar senhas, tokens, cookies, codigos 2FA, conteudo de `.env`, chaves privadas ou
material de autenticacao ao Git.
