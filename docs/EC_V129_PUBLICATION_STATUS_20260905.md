# V129 — publicação aprovada e pendências do freeze

Atualizado em 2026-09-05 UTC (2026-09-04 em São Paulo).
Escopo exclusivo: Vitalismen Ecuador, VPS 72.60.137.77.

## Produção

A resposta humana `aprovado` autorizou a candidata apresentada. Antes de
publicar, commit e tree foram conferidos sem qualquer alteração:

- Commit: `ef05d0968e1052bef19a9c13146c2c989a1c8658`.
- Tree: `48eeef3aea6ec6adbeabd46ef45e6b67e13f51c3`.
- Tag: `production-20260904-ef05d09`.
- Release: `/opt/vitalismen-automacao/releases/20260904T234516Z_production-20260904-ef05d09`.
- Baseline anterior: `20260904T223442Z_production-20260904-40f9ddb`.

O helper oficial concluiu publicação V70, preflight, validação e ativação
com permit root temporário de uso único. O helper V78 restaurou o perfil
operacional já aprovado. Nenhum helper foi editado. A branch `production`
permaneceu inalterada; somente a tag exata da publicação foi criada.

PM2 `vitalismen-automation`: PID 3708736, online; `pm_cwd` aponta para
`/opt/vitalismen-automacao/current`, execução `current/src/index.js` e
`/proc/3708736/cwd` resolve para a release V129. As 54 flags operacionais
comparadas permaneceram iguais. A única diferença adicional encontrada na
primeira comparação foi `SHLVL`, que é nível do shell, não flag operacional.
Os demais processos PM2 preservaram PID, status, CWD e executável.

Health público HTTP 200, online, Z-API conectada, WhatsApp pronto e política
`EC_BOT_CORE_OPERATIONAL`. Nginx/Mongo e timers V114/V116 ativos. As páginas
públicas `qr.html` e `leads-window.html` têm hashes iguais aos arquivos
aprovados. Endpoint de produtos sem token retorna 401.

## Snapshot e integridade

Snapshot verificado:
`/opt/vitalismen-automacao/backups/v129-prepublish-20260904T235735Z`.

Contém código da release anterior, arquivo Mongo gzip, backup SQLite criado
pelo mecanismo próprio e validado com integrity_check, estado PM2 privado,
bundle operacional e SHA256SUMS. Credenciais não foram publicadas no Git.

Fingerprint funcional esperado da V129:
`24ad2fbe423208cc305787e4821866329772663382ee879ee16e3bcfd5a76133`.

Após o teste real e o uso do painel, o plano de rollback falhou no fingerprint.
Diagnóstico exato: sete arquivos gerados em runtime entraram na pasta imutável:

- `public/media/uploads/1788566698625_ab9c67071f17.mp3`: áudio do teste QA;
- seis arquivos em `public/media/remote-cache`: três imagens e suas metadatas.

Fingerprint com os artefatos:
`9350cfcdf9be1eb18f0107824101e29e7c67f56fd049c344d1df1ab552515c6a`.
O cálculo diagnóstico excluindo somente esses sete arquivos resulta exatamente
no fingerprint aprovado. Isso comprova que a divergência é de artefatos
gerados; não houve modificação do código aprovado.

Os sete arquivos foram copiados para `runtime-media-preserved` dentro do
snapshot, com hashes em `runtime-fingerprint-diagnosis.json`. Nenhum foi
apagado ou movido, nenhum histórico foi alterado e nenhum guard foi contornado.
O plano oficial de rollback continua bloqueado; não foi executado rollback.

Fonte da escrita: `src/routes/whatsapp.js`, função `remoteMediaCacheDir` e
ramo data URL de `POST /send`. Ambos usam `process.cwd()/public/media`.
O armazenamento inbound V30 em `shared/media/inbound` já existe, mas não cobre
esses dois destinos. Não foi alterada a implementação de armazenamento.

Resolver essa pendência exige autorização explícita para uma terceira área,
conforme item 21 da solicitação: persistir uploads manuais/cache fora da release,
preservando URLs, histórico, IDs e bytes das mídias e verificando Range/player.
Não basta excluir arquivos do guard nem apagar o áudio de teste.

## Teste real QA

Somente `5515998038637` recebeu envios desta missão. Zero Order e zero Shipment
antes/depois. Nenhuma chamada Dropi ou Meta Purchase foi realizada pela missão.
O QA permaneceu testOnly, sem contexto de automação armado.

| Etapa | Evidência |
| --- | --- |
| Entrada real inicial | `QA V129 entrada 1`, inbound; consultas rápida e completa: unread 23, unanswered 7 |
| Marcar leitura | POST público autenticado: success, matched 1; contadores 0/0 persistidos |
| Texto manual | Z-API `E6FA2B39073E430DBA7E`; entregue/lido; uma mensagem lógica, isFromMe=true, senderRole=human |
| Áudio manual | Z-API `3EB03D53D5F496CA86A239`; tom de teste de 1,5 s; entregue/lido; uma mensagem lógica, isFromMe=true, senderRole=human |
| Eco | Ambos confirmados como fromMe=true sem duplicação |
| Refresh após texto/áudio | Consulta rápida: 0/0 |
| Sincronização completa após áudio | Consulta completa: 0/0 |
| Nova entrada posterior | Entradas reais posteriores chegaram; o painel aberto persistiu leitura antes da captura dos contadores |
| Reabertura observada antes da leitura | Pendente: solicitado envio direto de `QA V129 entrada 2` com painel fechado |

O print do operador confirma bolhas inbound brancas e texto/áudio outbound.
O rótulo visual genérico `bot` não corresponde a `isBot=true`: os registros
conferidos têm `isBot=false` e `senderRole=human`. Esse rótulo não foi alterado.

## Dropi após publicação

Os três produtos oficiais retornam `dropiEnabled=true`, autorização obrigatória
e `directAutomaticSend=false`. Leads 3494/3464 mantêm Vit Power/Tex Ultra,
respectivamente, `adminLeadReady=true` e `authorization_required`, sem Order
materializado na captura. O pedido 3435 foi consultado somente como referência.
Nenhum pedido desses casos foi enviado pela missão.

## Validação e correção exclusiva de teste

- Candidata aprovada: npm test 758/758; regressões dirigidas 156/156; lint 784.
- Produção após deploy: senior 497/497; testes específicos 24/24;
  regressões dirigidas adicionais 148/148.
- A execução adicional completa de V127 revelou 7 PASS e 1 FAIL: o último teste
  exigia o hash do painel inteiro na V125, incompatível com o microdiff V129.
  Essa asserção não estava incluída na seleção de testes anterior ao gate;
  deveria ter sido identificada antes da aprovação. A falha não foi omitida.

Correção preparada na branch `codex/ec-v129-validation-evidence-20260905`:

1. O teste de integridade V127 conserva hashes de auth, middleware, index e
   perfil; para o painel, exige o manifesto V129 validado e seu hash exato.
2. O guard/manifesto B declara somente esse teste como override adicional,
   protegendo seu novo hash. Manifestos ancestrais permanecem intactos.
3. Nenhum arquivo funcional em `public/`, `src/` ou carregador V97 foi alterado
   em relação ao commit publicado. Diff de validação: três arquivos, +10/-6.

Após a correção local: V127 + read-state 14/14; regressões 156/156, sem skips;
npm test 758/758, senior 497/497, lint 784 e diff --check PASS. Uma tentativa
intermediária de seleção por nome continuou executando a asserção antiga; foi
descartada. A correção final executa a suíte completa, sem suprimir testes.

Essa correção não foi aplicada à release ativa. Novo commit/tree exige nova
validação de publicação segundo o item 25 da solicitação.

## Estado de encerramento

`PRODUCTION_CHANGED=YES` — somente pela publicação aprovada V129.
`FUNCTIONAL_SOURCE_COMMIT_UNCHANGED=YES` — ef05d09 continua ativo.
`MEDIA_STORAGE_CHANGE_EXECUTED=NO`.
`FINAL_FREEZE=BLOCKED` — integridade de runtime/rollback e captura de reabertura
QA ainda pendentes; correção de teste preparada separadamente.

Nenhuma nova tag de freeze foi criada. O estado
`VITALISMEN_EC_DROPI_MULTIPRODUCT_AND_HANDLED_STATE_FROZEN_OPERATIONAL`
não foi declarado.
