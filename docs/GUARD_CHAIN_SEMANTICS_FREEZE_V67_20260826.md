# Freeze V67 — semântica canônica da cadeia de guards

Data: 2026-08-26
País/projeto: EC / Vitalismen Automação oficial
Estado: candidata local; sem staging, deploy, instalação de helper ou startup

## Incidente reproduzido

No tree funcional V66 `c97c29815aa4a4c47eb44bb091dcde0f861a733e`, o
guard V66 passava e os executáveis runtime V64/V65, quando chamados crus em
novos processos, falhavam no freeze V47:

```text
[EC-REPURCHASE-SQLITE-V47] herança divergente em
src/services/guidePrintDispatcherService.js
```

O freeze logístico V29 registra para esse arquivo o SHA-256
`86d4feb9d5e93839ce1786c569b10c7d60c55916eb610b1612348dbdb0da547c`.
A V66 alterou legitimamente o dispatcher para obrigar decisão central,
idempotência e lock persistente antes da borda de mídia. A V66 declarou o
arquivo em `declaredAncestorOverrides` e o protegeu com o SHA-256 sucessor
`6c0240c66cacb6545de48a9fa0531f484b75334d0372d969bfddf9c8e50505da`.

## Causa técnica

`globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES` é estado local ao processo
Node. Cada wrapper sucessor o define antes de importar o predecessor e o
restaura em `finally`. Um novo processo iniciado diretamente pelo executável
V64 ou V65 não herda esse estado e não tem como inferir que está num tree V66.
Por isso o executável ancestral cru representa o seu freeze isolado e deve
falhar diante de mudança posterior. A integridade do ancestral num tree
sucessor é validada dentro do contexto estabelecido pelo guard sucessor.

O V66 não mascarava a falha: ele usa `await import(...)` no mesmo processo,
sem `spawn`, `catch` ou conversão de erro em warning. Qualquer exceção
ancestral interrompe a importação e produz exit diferente de zero. O problema
operacional era tratar executáveis crus ancestrais como validadores
autoritativos do tree sucessor e manter aliases npm com semânticas diferentes.

Classificação formal:

- **B — SUCCESSOR CONTEXT NOT PROPAGATED**: esperado entre processos;
- **C — RAW ANCESTOR GUARD NOT VALID ON SUCCESSOR TREE**;
- **G — OTHER**: procedimento operacional e aliases não definiam uma única
  entrada canônica;
- não ocorreu `UNDECLARED SUCCESSOR OVERRIDE`, mascaramento do V66, erro do
  freeze histórico ou adulteração de manifesto.

## Contrato canônico V67

O único executável runtime autorizado para validar o tree atual é:

```bash
npm run guard:runtime-chain-v67
```

O preflight completo de código-fonte é:

```bash
npm run guard:predeploy-v67
```

O V67 valida seu manifesto e o hash imutável do parent V66, estabelece um
contexto sucessor formal e escopado, aguarda a cadeia V66 → V47 e valida seus
próprios arquivos protegidos. Não há subprocesso ancestral, `catch`, warning
ou resultado ignorado. Uma falha em qualquer elo permanece exceção não
capturada e encerra o processo com exit 1.

Os aliases npm V64/V65/V66 passam primeiro pela cadeia runtime V67 e depois
executam apenas o guard estático/testes da respectiva função. Assim, o nome do
alias continua disponível para regressão, mas seu resultado no tree atual não
alega que um executável ancestral cru reconheceu o sucessor.

Diagnóstico explícito, fora dos gates oficiais:

```text
ANCESTOR FREEZE INTEGRITY ON V67 TREE = validada pela cadeia canônica
RAW V64/V65 RUNTIME EXECUTABLE ON V67 TREE = semanticamente inválido e esperado FAIL
```

## Preservação e proibições

Os manifests e runtime guards V47, V64, V65 e V66 permanecem byte a byte
inalterados. O arquivo funcional `guidePrintDispatcherService.js` também não
foi modificado pela V67. Permanecem preservados `SAFE_OBSERVATION_ONLY`,
`REPORT_ONLY`, o safety ledger, `notificationStage`, validação provider-edge,
compatibilidade de rollback e zero scheduler por padrão.

A versão de compatibilidade de dados continua 66. V67 altera somente o
contrato de proteção e invocação de guards. Esta missão não autoriza staging,
permit, instalação do helper, bridge, mensagens, Dropi APPLY, Mongo, PM2 ou
alteração de `/current`.

## Rollback da candidata

Descartar o commit V67 antes de staging retorna ao código anterior. Nenhum
rollback de produção ou de dados é necessário, pois esta candidata não foi
publicada nem executou mutações. A release imutável do incidente permanece
preservada em
`/opt/vitalismen-automacao/releases/20260826T215201Z_production-20260826-c97c298`.
