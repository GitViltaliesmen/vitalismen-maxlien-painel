# Inventário prévio — sucessor de publicação EC V202-R5

Estado em 2026-09-27, antes de qualquer alteração no VPS. Release ativa:
20260925T195542Z_production-20260925-fe32da0. Commit:
fe32da042617335d11b9fcde2e5dc0d4519c9915. Tree:
fe3c34e7a47d3e291c1d4c349e493ebbc93c9b6c. PM2 vitalismen-automation
online com cwd e script apontando a /opt/vitalismen-automacao/current.
/api/health retornou HTTP 200, status online, Z-API conectada, fila inbound 0
e nenhum motivo de degradação.

## Cadeia atual

1. Candidato Git identificado por ref, commit, tree e nome de release.
2. /usr/local/sbin/vitalismen-stage seleciona o preload por checkpoint root.
   Para R4 aceita somente as três identidades exatas congeladas, a última
   sendo fe32da0.
3. Verificador R4 compara blobs Git, manifesto e 83 caminhos protegidos;
   grava atestação antes de remover .git da release materializada.
4. Stage executa guards de runtime/predeploy, freeze lock, auditoria oficial,
   senior:check e demais gates. Preload R4 valida a cadeia ancestral V47
   sem editar artefatos históricos.
5. Publicação gera metadados e tag. Preflight V66 valida candidata e
   rollback; v66-activate-safe troca current atomicamente.
6. Controle operacional V78 seleciona preload e perfil, valida identidade de
   release/checkpoint, atualiza PM2 e testa health.
7. Se a ativação V66 falha, o symlink anterior é restaurado, mas o runtime
   antigo não é reiniciado implicitamente. Retorno operacional a fe32da0
   exige executor sucessor específico e validação posterior.

Nenhum ponto autoriza copiar arquivos sobre current, reusar commit/tree antigos
ou relaxar um guard ancestral.

## Inventário root e hashes

| Caminho | Owner:group | Modo | SHA-256 | mtime UTC |
| --- | --- | --- | --- | --- |
| /usr/local/sbin/vitalismen-stage | root:root | 755 | c0307f56acc20aedf790d97ba64203830b1a647d74380c78ec9d57487f4b8804 | 2026-09-25 19:55:03 |
| /var/lib/vitalismen-deploy/CHECKPOINT_R4_V78_PAYLOAD_AUTHORITY.json | root:root | 400 | 8ba9fd21befdb6a73698d726aea7e340dce0dc93cbb4f0ff91d3b3c507f5be6d | 2026-09-25 05:03:31 |
| /var/lib/vitalismen-deploy/CHECKPOINT_R4_V78_CONTROL_PLANE_AUTHORITY.json | root:root | 400 | 77e100d51a78d070d7f29644fce50aaf37465b797088b35492e | 2026-09-25 17:39:37 |
| /var/lib/vitalismen-deploy/CHECKPOINT_R4_V78_CONTROLLER_PIN_AUTHORITY.json | root:root | 400 | edbc4130dee6d49b3cef5217ea22ad2bdce17447406450efbcac47404ef20ee5 | 2026-09-25 19:50:40 |
| current/ops/vitalismen-stage | root:root | 700 | c0307f56acc20aedf790d97ba64203830b1a647d74380c78ec9d57487f4b8804 | 2026-09-25 19:55:55 |
| current/ops/vitalismen-rollback-v201-r4.mjs | root:root | 600 | 01291dfd9121c6dca283aef3491d63e9547aef9e34827f3b34288b985c1768ce | 2026-09-25 19:55:55 |
| current/scripts/guard-unified-successor-v202-r4.mjs | root:root | 600 | 420f49cd8647df8fcddaeed67b957ce510d85ce28eaace2b00c748cdf62ceb8e | 2026-09-25 19:55:56 |
| current/scripts/verify-unified-successor-v202-r4-stage.mjs | root:root | 600 | 0f0636fdebe5337a09d78fbfae690131accf30a16dc7650f4ac2cc6cb39e7e04 | 2026-09-25 19:55:56 |
| current/scripts/lib/unified-successor-v202-r4-authority.mjs | root:root | 600 | cc0393de6c62bf8de1ade8b9caccd544df37a8745409bb9fe10fe3ad377454d5 | 2026-09-25 19:55:56 |
| current/scripts/lib/unified-successor-v202-r4-preload.mjs | root:root | 600 | 994408c3739587b0a53967bf4ce52deae238f4f9ce7bd3ec325919706e59a3d7 | 2026-09-25 19:55:56 |
| current/docs/freeze/unified-successor-v202-r4-v78-controller-pin-20260925.json | root:root | 600 | 5db4769b20956ae9aba52293e1699b8fdbf4999aaa9ed8f62d74a8e9c7c9c349 | 2026-09-25 19:55:55 |

Timers Vitalismen observados: meta-ads-insights-v141,
postsale-next-eligible-v114, postsale-full-v188 e
buy-later-followup-v162. Há cron diário de auditoria Meta EC.
Não são controles de publicação e não foram alterados.

## Quatro falhas históricas

| Teste | Pressuposto histórico | Estado atual aprovado | Avaliação |
| --- | --- | --- | --- |
| V101 rotas atuais | SHA de src/routes/zapi.js igual a V90/V110/V111 | R4 fixa 8dc6888f21514fbe1cc8dfa52aa97c552fe8883926ceb550509ef4a069580608 | Governança obsoleta; sem risco funcional novo identificado |
| V101 manifesto/parent | public/leads-window.html igual a V100 8d668c9d8a162b14ac4278f2ec244021e44b11a22221b339041dd8677415350f | V158 fixa 6ea45f42c7c55dad7bb91073c4ae173689dd69e2ed056aa9c1be238c7afce926 | Governança obsoleta; sem risco funcional novo identificado |
| provider-only baseline | public/qr.html igual a V171 11b0b3cf80fa5b24d2bf1ddded7b3455af1f505d8c456be1da82ade706294110 | R4 fixa a5a374227dc21b9241f487cb4ef9f04f4eb88207eb71fde55616b552d123913f | Governança obsoleta; sem risco funcional novo identificado |
| provider-only diff | Desde ebaccf0, somente quatro artefatos provider-only mudam | R4 publicado contém numerosos sucessores posteriores; missão atual autoriza dois patches isolados | Teste de missão histórica não se aplica ao diff atual |

O V47 cru compara o workflow com SHA ancestral V28
2748a7157e4f6e7918561dbc162d1969f110a35da065797cabe9f28b9b962ded.
O manifesto R4 atesta o workflow atual como
ce8eba69bdda6bac782190e31b746052317255fd18f50b6131a9dd116416aa46.
A sucessão R5 precisa provar essa identidade, preservando V47 e R4.

## Restrições para R5

- Novo checkpoint root imutável deve referenciar o checkpoint R4
  edbc4130dee6d49b3cef5217ea22ad2bdce17447406450efbcac47404ef20ee5,
  e pinrar commit/tree, manifesto, controles e dois hashes funcionais novos.
- Diff funcional desde fe32da0: somente sendText.js e
  servientregaEcuadorAgencyService.js. Testes e governança são separados.
- Helper aceita R5 sem ampliar identidades aceitas pelo ramo R4.
- Preload, seletor V78, contrato V78, controlador PM2 e rollback devem
  reconhecer R5 explicitamente. Não é seguro apresentar R5 como R4.
- Release fe32da0 permanece disponível como alvo de rollback operacional
  validado; restaurar só o symlink não satisfaz PM2 online.

## Delimitação da candidata

O checkout isolado foi criado a partir de fe32da0 porque a autorização exigiu
um worktree limpo. O guard `npm run official:path` permanece inalterado e
recusa esse caminho local por desenho; ele passa na pasta oficial Windows e
deve passar na release sob `/opt/vitalismen-automacao/current`. Nenhuma
exceção foi codificada no guard.

Além dos dois arquivos funcionais e duas regressões pinadas, R5 acrescenta
somente documentação, testes de governança e controles de publicação. A
alteração em `src/services/ecBotCoreOperationalV78Service.js` é apenas a
seleção/autorização da identidade operacional R5. Ela não muda mensagens,
ofertas, preços, produto, pedidos, envio ou lógica comercial do bot. Os
artefatos V47 e V202-R4 da release antiga permanecem byte-intactos; os ramos
R4 do novo código de controle continuam explícitos.

O rollback R5 verifica antes de qualquer troca a release anterior R4,
seu commit/tree, o checkpoint, o controlador PM2 e os três hashes do bundle
operacional R4. `--dry-run` não altera estado. Se necessário, restaura o
symlink por rename atômico, o bundle R4 arquivado pelo `supersede`, reinicia
somente `vitalismen-automation` com o controlador R4 e exige health/Z-API.
