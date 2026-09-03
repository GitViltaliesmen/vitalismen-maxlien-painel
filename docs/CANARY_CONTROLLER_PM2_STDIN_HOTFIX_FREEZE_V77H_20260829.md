# Freeze V77H — correção isolada do stdin do verificador PM2 do canário

Data: 2026-08-29
País e sistema: Vitalismen Ecuador oficial
Base imutável: commit `5bedd9154c4ba0b69f0477e059473dcf7012d38a`, tree `681b6fd3249065e6b745eb346cbc5ff093185d1e`
Estado desta camada: candidata exclusivamente local; nenhuma ação de produção autorizada

## Incidente delimitado

O helper V77 combinava dois produtores para o mesmo stdin no verificador
`verify_candidate_pm2_canary_v77_env`:

```sh
"$pm2_cmd" jlist | "$node_cmd" - ... <<'NODE'
```

O `node -` precisava ler o código JavaScript do stdin ao mesmo tempo em que o
pipe tentava entregar o JSON de `pm2 jlist`. O heredoc assumia o descritor e o
produtor PM2 podia receber `EPIPE` antes de terminar a escrita. O canário falhou
fechado e foi contido, sem ciclo QA e sem efeitos externos.

## Correção autorizada

V77H separa deterministicamente código e dados:

- o JavaScript reside no contrato versionado
  `scripts/lib/canary-controller-pm2-stdin-hotfix-v77h-contract.mjs`;
- `pm2 jlist` é o único produtor do stdin;
- o consumidor usa `fs.readFileSync(0, 'utf8')`, aguardando EOF antes de
  interpretar o JSON;
- JSON vazio, truncado ou não-array falha fechado depois da leitura integral;
- nenhuma combinação `node -` + heredoc permanece no verificador.

## Invariantes preservadas

O hotfix não muda overlay, perfil, permit, attestation, expiração, health,
ativação ou contenção V77. Continuam obrigatórios:

- exatamente um `vitalismen-automation`, online e com PID positivo;
- `pm_cwd=/opt/vitalismen-automacao/current`;
- `pm_exec_path=/opt/vitalismen-automacao/current/src/index.js`;
- `/proc/<pid>/cwd` resolvido para a release candidata exata;
- correspondência de todas as chaves do overlay PM2;
- overlay arquivo real, `root:root 0400`;
- permit válido, não vencido, de uso único e consumido somente após os gates;
- cinco allowlists contendo exclusivamente `5515998038637`;
- nenhum segundo destinatário;
- Dropi `REPORT_ONLY`, APPLY bloqueado e Meta bloqueada;
- carrier sweep, guia/print, bônus, recompra, follow-ups e backlog bloqueados;
- contenção fail-closed em qualquer divergência.

Antes do consumo do permit, o helper calcula um SHA-256 determinístico dos
outros processos PM2 usando apenas nome, status, PID, cwd e exec. Depois do
restart exclusivo do alvo, o verificador exige o mesmo fingerprint. Qualquer
alteração externa bloqueia a ativação e aciona a contenção V77 existente.

## Testes de segurança

A suíte V77H cobre:

- pipe real com JSON maior que o buffer, consumidor até EOF e zero `EPIPE`;
- caminho positivo com um alvo, PID, cwd/exec, overlay e cinco allowlists QA;
- JSON vazio e truncado;
- processo ausente e duplicado;
- status, PID, cwd, exec e `/proc/<pid>/cwd` divergentes;
- overlay divergente, segundo destinatário, Dropi, Meta e scheduler proibido;
- owner, mode e symlink divergentes no overlay;
- alteração em qualquer processo PM2 externo.

## Escopo negativo

Esta microlayer não altera VPS, helper instalado, releases existentes,
`/current`, PM2, `.env`, banco, Z-API, WhatsApp, Dropi, Meta, schedulers,
mensagens, canário, bot ou tráfego. Também não autoriza commit, push, tag,
stage, deploy, instalação do helper ou nova tentativa de canário.

## Rollback local

Antes de qualquer publicação futura, o rollback da candidata é remover somente
os arquivos novos V77H e restaurar, pelo Git, os arquivos da lista de overrides
ao commit base V77 `5bedd9154c4ba0b69f0477e059473dcf7012d38a`. Como esta etapa é somente local,
nenhum rollback de produção, dados ou processos é necessário.
