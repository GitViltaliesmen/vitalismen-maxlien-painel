# Auditoria e restauração integral Vitalismen EC — 2026-09-02

Status final desta execução: **OPERACIONAL_COM_PENDENCIAS**.

Escopo exclusivo: Vitalismen Ecuador, VPS `72.60.137.77`, domínio
`https://ec.maxlien.shop/n/`, automação em
`/opt/vitalismen-automacao/current`. Nenhum projeto, banco, transporte ou
cliente de outro país integrou esta auditoria.

## Resultado executivo

- O serviço público não está fora do ar: Nginx, MongoDB, PM2 e Z-API estão
  online, e as páginas operacionais respondem HTTP 200.
- A entrada e a resposta individual pela Z-API estão funcionando. Baileys está
  desabilitado e não é requisito operacional enquanto a Z-API oficial estiver
  conectada.
- A produção está em um modo parcial não permitido pelo contrato atual:
  funil/resposta automática ligados, mas scheduler e pós-venda desligados.
- A recompra continua defeituosa no release de produção. A correção sistêmica
  V99/V100 está pronta, testada e publicada no Git, mas ainda não está ativa na
  VPS.
- A integração manual Dropi do release ativo falhou no caso prioritário `3469`.
  A correção V98 para a BFF atual está pronta e testada, mas ainda não está
  ativa na VPS.
- O pós-venda seguro V66 está implementado com locks e ledgers persistentes, e
  a ponte de dados já foi concluída no Mongo. O runtime ativo não contém a
  composição sucessora necessária e as flags operacionais estão desligadas.
- Nenhuma mensagem, mídia, evento Meta, pedido Dropi, backfill ou reinício foi
  disparado durante a varredura. O risco de avalanche histórica foi preservado
  em estado bloqueado.
- A publicação ficou impedida por uma trava real da infraestrutura: o helper
  oficial informa `ATIVACAO_PERMITIDA=NAO`, e o usuário SSH `codex` não possui
  permissão para criar o release candidato nem atualizar o helper/symlink.

## Baseline imutável observado antes de qualquer ajuste

- `CURRENT_REAL=/opt/vitalismen-automacao/releases/20260902T064628Z_production-v60-dropi-bff-a691b7e`
- `COMMIT_REAL=a691b7e52defd369cab3a7e451425197f1571642`
- `TREE_REAL=177537cc1ad0d12a55f56aa230ab40d301d31ff9`
- `PM2_STATUS=online`
- `PID=3349852`
- `RESTART_TIME=2026-09-02 06:52:00` (relógio da VPS)
- `PM_CWD=/opt/vitalismen-automacao/current`
- `PM_EXEC_PATH=/opt/vitalismen-automacao/current/src/index.js`
- `HEALTH_INTERNO=200 status=ok`
- `API_HEALTH_INTERNO=200 status=online`
- `HTTP_PUBLICO=/n/ 200; /qr.html 200; /leads-window.html?country=EC 200`
- `MONGO=online`
- `NGINX=active`
- `ZAPI=connected`, telefone oficial final `8416`, saída não bloqueada
- `BAILEYS=disabled/disconnected`, sem degradação do transporte oficial
- fila inbound observada: zero; tráfego recente presente

O helper instalado é V72/runtime V71. Ele reconhece o release e o processo PM2,
mas não possui o contexto sucessor V97 em `NODE_OPTIONS`, `node_args` ou
`interpreter_args`. O status retornou:

- `STAGING_PERMITIDO=SIM`
- `ATIVACAO_PERMITIDA=NAO`

O sudo disponível permite somente status, ativação pelo helper, uma receita
histórica específica que não corresponde a esta candidata e o diagnóstico
somente leitura. `/opt/vitalismen-automacao/releases` e o symlink `current` não
são graváveis pelo usuário atual. A receita histórica não foi usada.

## Matriz do que funciona e do que não funciona

| Subsistema | Estado | Evidência e decisão |
| --- | --- | --- |
| Nginx e páginas públicas | FUNCIONA | `/n/`, painel e leads retornaram 200 |
| PM2 no release atual | FUNCIONA | processo online; `pm_cwd` e `pm_exec_path` apontam para `current` |
| MongoDB | FUNCIONA | banco oficial acessível; 203 Orders, 188 Shipments e 16.953 Messages |
| Z-API oficial | FUNCIONA | conectada ao telefone oficial; outbound não bloqueado |
| Baileys | DESLIGADO/ACEITO | não é transporte obrigatório na operação atual |
| Entrada e resposta individual | FUNCIONA | tráfego recente e health sem degradação |
| Painel e ficha de cliente | FUNCIONA | rotas acessíveis; seleção, cidade, província e correção humana preservadas |
| Seleção multiproduto por cliente | FUNCIONA | origem VSL e produto manual permanecem separados |
| Criação/confirmação de pedido novo | FUNCIONA | Orders confirmados e Meta Purchase idempotente nos casos amostrados |
| Recompra no release ativo | NÃO FUNCIONA | pedido entregue pode continuar como atual e impedir novo `EC-RECOMPRA-*` |
| Recompra na candidata V99/V100 | CORRIGIDA NO GIT | novo Order, linhagem do anterior e precedência de tela testados |
| Dropi manual no release ativo | PARCIAL | caso `3469` rejeitado pela integração antiga e deixado para revisão |
| Dropi manual na candidata V98 | CORRIGIDA NO GIT | BFF atual, lookup prévio, idempotência e erros sanitizados testados |
| Dropi automático | DESLIGADO/ACEITO | deve continuar proibido; não foi ativado |
| Meta/CAPI | FUNCIONA | configuração presente e Purchase aceito uma vez nos pedidos amostrados |
| Pós-venda no release ativo | NÃO EXECUTA | scheduler e flags logísticas desligados |
| Pós-venda seguro V66 | PRONTO NO GIT/DADOS | bridge Mongo concluída; locks, ledgers e histórico testados |
| Anti-spam de guia/mídia | FUNCIONA NA CANDIDATA | guard específico passou; backlog segue bloqueado |
| Modo operacional coordenado | NÃO CONFORME NA VPS | combinação parcial de flags não corresponde aos dois estados oficiais |
| Deploy da candidata | BLOQUEADO | helper sem contexto V97 e permissão SSH insuficiente |
| Auditoria de dependências | PENDÊNCIA MODERADA | 3 achados transitivos; zero alto e zero crítico |

## Flags efetivas observadas na produção

Captura de `GET /api/automation/status` em 2026-09-02:

| Capacidade | Estado observado |
| --- | --- |
| Scheduler global | desligado (`DISABLE_SCHEDULER=1`) |
| Resposta automática | ligada |
| Funil | ligado |
| Follow-up de produto | desligado |
| Dispatch de status de remessa | desligado |
| Carrier sweep | desligado |
| Importação do painel | desligada |
| Meta EC | configurada; segredo não exibido |
| Piloto | desligado; allowlist somente QA final `8637` |
| Fila WhatsApp | zero |

Contagens de risco antes de qualquer liberação:

- 5 candidatos de dispatch;
- 37 candidatos de carrier sweep;
- 54 itens de revisão manual;
- 563 atendimentos retidos para humano;
- 1 candidato de reengajamento;
- 0 bloqueios por saldo;
- 0 itens na fila WhatsApp.

`WHATSAPP_BACKLOG_RECOVERY_ENABLED` deve permanecer explicitamente `false`.
Nenhuma dessas contagens autoriza replay histórico.

## Auditoria de perfil e persistência manual

As proteções V50, V51, V55, V56 e V57 continuam presentes. Os casos atuais
inspecionados demonstram que correções humanas são gravadas com fonte
`human_correction`, `corrected_by_human=true`, lock e score de completude.

O caso final `6477` confirma persistência de Loja/Loja, modalidade agência,
lock humano e `orderDataReady=true`. Não foi encontrada evidência que
justificasse alterar a camada de perfil. A regressão específica passou 19/19.

## Identificadores urgentes resolvidos

Os cinco valores são sufixos do telefone operacional exibido no painel, não IDs
Mongo. O valor `1091` também colide com um lead SQLite histórico de outra
pessoa; a identidade correta foi desambiguada por telefone, conversa e pedidos.

| Identificador | Entidade canônica | Estado | Recompra? | Ação segura |
| --- | --- | --- | --- | --- |
| `4152` | contato final `4152`; lead `2239` | atendimento antigo; sem Order/Shipment | não | manter humano; não inventar compra |
| `1091` | contato final `1091`; lead `1497` | pedido entregue e nova intenção explícita em 2026-08-31; sem novo Order | sim, ausente | backfill único somente após V99/V100 ativa |
| `7460` | contato final `7460`; lead `3465` | negociação nova Tex Ultra; sem compra anterior | não | concluir ficha como venda nova |
| `1524` | contato final `1524`; lead `3469` | `EC-MTJKKKV0-7Z7O` confirmado; Dropi em revisão | não | prioridade máxima do Dropi manual |
| `6477` | contato final `6477`; lead `3487` | `EC-MTKES79G-9XIL` confirmado; sem Shipment | não | seguir fluxo manual sem duplicar |

O caso `1091` possui um pedido anterior entregue, Dropi `5855679`, guia
`185531793` e uma intenção posterior inequívoca de comprar três unidades e uma
unidade adicional com retirada em agência. Não existe novo `EC-RECOMPRA-*`.
Esse é o único backfill de recompra comprovado dentre os cinco identificadores.

## Recompra já recuperada antes desta varredura

O telefone informado pelo operador, final `6509`, foi reparado de forma
pontual e verificada antes desta auditoria ampla:

- novo pedido `EC-RECOMPRA-MTKEFGCW-RZA8`;
- Vit Power, 2 frascos, USD 70;
- pedido anterior `EC-DROPI-5756679` preservado como histórico entregue;
- Meta Purchase aceito uma única vez;
- nenhum Shipment novo e nenhuma autorização/submissão Dropi criada;
- painel passou a exibir a recompra atual sem apagar o histórico.

Essa intervenção não substitui a ativação sistêmica V99/V100 para os próximos
casos.

## Prioridade Dropi `3469`

O lead `3469`, final `1524`, possui pedido confirmado Tex Ultra de 1 frasco por
USD 35,99 e ficha completa para retirada em agência em Cuenca/Azuay. O Shipment
está em `manual_send_required/dropi_rejected`, com autorização histórica, mas
sem `submittedAt`, ID Dropi ou rastreio. O erro registrado afirma que a Dropi
não confirmou a operação.

Não foi feito novo POST durante a auditoria. A sequência autorizada e segura é:

1. ativar V98 no release oficial;
2. pesquisar na Dropi autenticada por telefone e referência do pedido;
3. se já existir, apenas sincronizar ID/status;
4. se estiver comprovadamente ausente, fazer um único envio manual;
5. confirmar ID Dropi, timestamp e ausência de duplicidade.

## Pós-venda e risco de backlog

O documento persistente `post-sale-safety-v66` existe no Mongo com:

- `bridgeComplete=true`;
- `dataCompatibilityVersion=66`;
- `minRuntimeVersion=66`;
- `writerRuntimeVersion=66`.

Os locks, ledgers e marcadores ficam embutidos nos Shipments; a ausência de uma
coleção separada não significa ausência de idempotência.

Os cinco candidatos atuais de dispatch são antigos:

- quatro estão em `EN_RUTA`, mas possuem evidência posterior de READY já
  recuperada; reenviar trânsito seria cronologicamente incorreto;
- um está `ENTREGADO` e aparece como candidato a bônus; ele possui histórico de
  guia/ready/print e tentativas anteriores, portanto exige reconciliação
  transacional antes de qualquer provider.

A candidata V66 exige gate de mutação explícito, bridge persistente e lock por
estágio. Antes de ligar o scheduler, os quatro estágios de trânsito devem ser
marcados como reconciliados somente a partir da evidência posterior já
persistida. O quinto deve continuar bloqueado se o histórico não comprovar de
forma inequívoca que o bônus ficou pendente. Nenhum cliente deve receber
mensagem para “testar” essa decisão.

Na primeira ativação, manter explicitamente desligados:

- `WHATSAPP_BACKLOG_RECOVERY_ENABLED=false`;
- recompra automática de 30 dias;
- carrier sweep em massa;
- reconciliação automática ampla pelo painel;
- qualquer job não necessário ao canário controlado.

## Correções versionadas

Branch: `codex/dropi-postsale-recovery-20260902`.

| Commit | Correção |
| --- | --- |
| `27b1786` | integra Dropi manual à base operacional BFF atual |
| `76fb8a8` | sela idempotência e recuperação manual da BFF |
| `de6a200` | cria recompra nova sem mutar a entrega anterior |
| `1c66b01` | mantém a recompra mais recente como pedido atual no painel |
| `f66ed8c` | compõe V90/V98 nos guards V61–V63 por caminho e hash exatos |

O commit candidato final é `f66ed8c`. Ele está publicado no Git oficial. A V101
não altera Z-API, Dropi, mensagens, banco, produto, preços ou flags; ela apenas
faz guards ancestrais reconhecerem hashes exatos já congelados nas sucessoras.

## Validações executadas

| Validação | Resultado |
| --- | --- |
| `npm run official:path` | PASS |
| lint sintático | PASS — 670 arquivos |
| `npm run senior:check` com contexto sucessor V97 | PASS — 454/454 |
| perfil/ficha/correção humana | PASS — 19/19 |
| recompra V99/V100 e regressões | PASS — 18/18 |
| pós-venda e anti-spam | PASS — 82/82 |
| conjunto crítico V98–V101 | PASS — 13/13 |
| `guard:predeploy-v71` | PASS |
| `guard:ec-product-micro-layer` | PASS |
| `guard:guide-print-spam` | PASS |
| guards diretos V61/V62/V63/V98/V99/V100/V101 | PASS |
| `git diff --check` | PASS |
| health somente leitura da VPS | PASS |
| suíte agregada `npm test` | BLOQUEADA somente pelo `npm audit` moderado |

As contagens pertencem a conjuntos parcialmente sobrepostos e não devem ser
somadas como se fossem casos únicos.

### Pendência de dependências

`npm audit --omit=dev --audit-level=moderate` encontrou três entradas
encadeadas referentes ao mesmo componente transitivo:

- `express@4.22.2`;
- `body-parser@1.20.6`;
- `qs@6.15.3`;
- severidade máxima: moderada;
- alto: zero;
- crítico: zero.

Os avisos são `GHSA-x5fp-wj9c-mxmx` e `GHSA-4mjr-xmp4-gh2g`. Em 2026-09-02,
`express@4.22.2` continuava sendo `latest-4` e fixa `qs` em `~6.15.1`, enquanto
a correção foi publicada em `qs@6.16.0`. `npm audit fix --dry-run` não encontrou
uma atualização compatível; forçar Express 5 seria uma migração major. Nenhuma
dessas opções foi aplicada sem uma bateria de compatibilidade própria.

Essa pendência não explica os incidentes de recompra, Dropi ou pós-venda, mas
impede declarar a suíte total como integralmente verde.

## Plano exato para concluir a restauração

1. Um administrador deve instalar o helper oficial sucessor ou conceder ao
   usuário de deploy uma regra sudo estrita para criar o release exato
   `f66ed8c`, sem compartilhar senha e sem liberar shell root genérico.
2. Criar release imutável pelo commit exato, validar árvore limpa e preparar
   backup do symlink, `.env`, estado Dropi persistente e configuração PM2.
3. Injetar o preloader V97 no processo e validar V101→V100→V99→V98 e toda a
   ancestralidade antes de mover `current`.
4. Reconciliar transacionalmente os cinco candidatos antigos, com provider
   zero e `WHATSAPP_BACKLOG_RECOVERY_ENABLED=false`.
5. Ativar o conjunto operacional inteiro exigido pelo senior guard, com lote e
   teto inicial de 1, e não uma flag isolada.
6. Confirmar `pm2 jlist`, `readlink -f /opt/vitalismen-automacao/current`,
   health interno, Z-API, fila zero e ausência de duplicidade.
7. Registrar a recompra comprovada `1091` pela V99, sem Shipment/Dropi
   automático e preservando o pedido entregue.
8. Resolver o lead `3469` pelo lookup autenticado e, somente se ausente, um
   único POST manual Dropi.
9. Observar logs/ledgers por uma janela controlada antes de aumentar qualquer
   lote.
10. Tratar o upgrade Express/qs em uma sucessora separada, com testes de rotas,
    autenticação, webhooks, uploads e parsers.

## Rollback preparado

O alvo anterior continua identificado pelo commit `a691b7e52def...` e release
`20260902T064628Z_production-v60-dropi-bff-a691b7e`. O rollback deve:

1. desligar novamente o scheduler e todas as flags acopladas;
2. impedir provider, Dropi e Meta durante a troca;
3. restaurar o symlink somente pelo helper oficial;
4. recriar apenas `vitalismen-automation` se `pm_cwd` ou `pm_exec_path` não
   apontarem para o release restaurado;
5. respeitar `minRuntimeVersion=66` e falhar fechado se o runtime alvo não for
   compatível;
6. validar health, Z-API e fila antes de reabrir entrada automática.

Nenhum gate de compatibilidade deve ser ignorado para forçar rollback.

## Conclusão

O sistema está **OPERACIONAL_COM_PENDENCIAS**: atendimento público, Z-API,
Mongo, painel, pedidos comuns, perfil e Meta estão operacionais; as correções de
recompra, Dropi manual e composição de guards estão prontas e testadas no Git;
o pós-venda seguro está preparado, mas deliberadamente inativo. A conclusão não
é `RESTAURADO_E_OPERACIONAL` porque o release candidato não pôde ser ativado com
as permissões disponíveis, o caso `1091` não pode ser backfillado antes dessa
ativação, o lead `3469` ainda exige resolução Dropi manual e a auditoria npm
mantém três achados moderados sem correção compatível na linha Express 4.
