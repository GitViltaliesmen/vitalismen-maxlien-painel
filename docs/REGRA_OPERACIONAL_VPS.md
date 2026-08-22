# Regra operacional: VPS como fonte de verdade

Objetivo: evitar refazer trabalho, evitar divergencia entre paineis/projetos e manter a automacao Vitalismen concentrada no ambiente correto.

## Fonte de verdade

- O VPS e o ambiente oficial de operacao.
- A pasta local oficial e `/Users/greson/Documents/Vitalismen Automacao`.
- O caminho local unico deve ser validado por `.vitalismen-official-root` e `npm run official:path`.
- A pasta local serve para revisar, testar e preparar mudancas antes de atualizar o VPS.
- Nao trabalhar a partir de zips, copias antigas, pastas duplicadas ou projetos paralelos.

## Regra anti-retrabalho

Antes de construir qualquer coisa nova:

1. Procurar no codigo existente com `rg`.
2. Procurar nos documentos em `docs/`.
3. Consultar `docs/ARQUIVOS_OFICIAIS.md`.
4. Verificar se o VPS ja tem a versao mais atual.
5. Ler o arquivo oficial atual antes de editar.
6. Confirmar se a tarefa e realmente nova ou se e ajuste de algo existente.
7. Registrar a decisao nesta documentacao quando ela mudar o fluxo operacional.

Se a tarefa parecer repetida, parar e responder com:

```text
Isso parece ja existir. Vou localizar a implementacao atual antes de refazer.
```

## Fluxo correto de trabalho

1. Entender o que ja existe.
2. Localizar e ler o arquivo oficial.
3. Se estiver no VPS, baixar copia atual ou inspecionar diretamente antes de alterar.
4. Fazer ajuste pequeno e direto na pasta local oficial ou na copia baixada do arquivo oficial.
5. Rodar teste local minimo.
6. Fazer backup antes de substituir arquivo em producao.
7. Atualizar o VPS.
8. Conferir no VPS/URL oficial.
9. Registrar o resultado.

## VPS

Informacoes conhecidas:

- Host usado em scripts: `root@maxlien.shop`.
- Chave usada em scripts: `~/.ssh/vps_auditoria_codex`.
- Base admin online lida por `scripts/import-vps-admin-confirmed.mjs`.
- Automacao oficial atual: `/opt/vitalismen-automacao/current`.
- Comando de guarda no VPS: `cd /opt/vitalismen-automacao/current && npm run senior:check`.

Antes de qualquer deploy real, confirmar:

- caminho da aplicacao no VPS;
- comando de restart do servico;
- se ha alteracoes locais ainda nao enviadas;
- se o banco/arquivos de sessao precisam ser preservados.
- rodar localmente `npm run official:audit` e corrigir qualquer falha antes de prosseguir.

### Ambiente oficial no VPS

Status: atualizado em 2026-05-12.

- Servico oficial PM2: `vitalismen-automation`.
- Pasta oficial em producao: `/opt/vitalismen-automacao/current`.
- Antes de qualquer novo teste no VPS, rodar `npm run senior:check` dentro de `/opt/vitalismen-automacao/current`.
- Regra dura anti-contaminacao: no VPS, a Vitalismen so pode rodar pelo PM2. Nunca iniciar `node src/index.js` manualmente em `/opt/vitalismen-automacao/current` ou em releases. O backend bloqueia esse inicio manual por padrao e sai com erro. Para reiniciar use somente:

```sh
pm2 restart vitalismen-automation --update-env
pm2 save
```

- Excecao emergencial, apenas se o PM2 estiver quebrado e sabendo que isso pode causar conflito: `VITALISMEN_ALLOW_MANUAL_NODE=true node src/index.js`. Depois de usar, matar o processo manual e voltar ao PM2.
- Flags obrigatorias:
  - `VITALISMEN_OFFICIAL_ONLY=true`;
  - `VITALISMEN_OFFICIAL_PRODUCT=Vit Power`;
  - `BOT_FORCE_AGENT=vit_power_ec`;
  - `WHATSAPP_AUTO_REPLY_ENABLED=true`;
  - `WHATSAPP_FUNNEL_ENABLED=false`;
  - `BOT_USE_APPROVED_AUDIO_ONLY=true`.

## Padrao de unificacao local/VPS

Use estes comandos como fronteira oficial entre ciclos:

```sh
cd "/Users/greson/Documents/Vitalismen Automacao"
npm run official:path
npm run official:audit
```

Esse comando verifica:

- guard local do funil Vit Power;
- flags locais que mantem o funil antigo desligado;
- API local e WhatsApp, quando estiverem rodando;
- formularios recentes com `Cantidad: 3` ou `Cantidad: 6` contra pedidos salvos;
- guard e flags do VPS em `/opt/vitalismen-automacao/current`.

Regra: se `npm run official:audit` falhar, nao iniciar novo desenvolvimento nem deploy ate corrigir a falha. Se houver apenas aviso de API local desligada, subir Mongo/API e rodar novamente.

## Deploy somente quando pronto

O VPS nao deve receber edicao manual do funil. A frente unica e local, na pasta:

```text
/Users/greson/Documents/Vitalismen Automacao
```

Fluxo correto:

1. desenvolver e testar localmente;
2. rodar `npm run senior:check`;
3. rodar `npm run official:audit`;
4. testar contato piloto;
5. somente entao subir para o VPS com confirmacao explicita.

O comando local abaixo monta e envia uma release candidata, mas nunca a ativa:

```sh
VITALISMEN_DEPLOY_TAG=production-YYYYMMDD-abcdef0 VITALISMEN_DEPLOY_CONFIRM=YES npm run deploy:vps
```

Esse comando:

- roda `official:audit` antes de subir;
- confere o `senior:check` do VPS legado;
- envia a versao local para `/opt/vitalismen-automacao/releases/<timestamp>`;
- nao copia `.env`, `auth_info_baileys`, `.local`, `node_modules` nem audios gerados;
- nao troca o symlink `current` e nao reinicia o PM2.

`VITALISMEN_DEPLOY_ACTIVATE=YES` e bloqueado pelo contrato atual e termina com
codigo `78`. A publicacao oficial completa usa o helper root transacional, uma
tag anotada exata e uma autorizacao de uso unico:

```sh
ssh root@72.60.137.77 "/usr/local/sbin/vitalismen-stage stage production-YYYYMMDD-abcdef0 YYYYMMDDTHHMMSSZ_production-YYYYMMDD-abcdef0"
ssh root@72.60.137.77 "/usr/local/sbin/vitalismen-authorize production-YYYYMMDD-abcdef0"
ssh root@72.60.137.77 "/usr/local/sbin/vitalismen-stage activate"
```

O primeiro comando faz staging e executa os gates sem alterar `current`. O
segundo cria a permissao root vinculada ao tag, commit e release exatos. O
terceiro consome essa permissao uma unica vez, troca `current` atomicamente,
reinicia somente `vitalismen-automation`, valida health e dominio, salva o PM2
e executa rollback automatico se algum gate falhar.

Depois da ativacao, a verificacao obrigatoria e:

```sh
ssh root@72.60.137.77 "readlink -f /opt/vitalismen-automacao/current && pm2 jlist"
```

O processo `vitalismen-automation` precisa estar `online`, com `pm_cwd` e
`pm_exec_path` passando por `/opt/vitalismen-automacao/current`, e o CWD real
do PID precisa resolver para a mesma release ativada. Nunca usar
`pm2 restart all`, porque o VPS contem processos fora do escopo Vitalismen EC.

## Estado atual registrado

### Manutencao painel WhatsApp e limpeza EC - 2026-05-20

Status: aplicado localmente e hotfix pontual aplicado no VPS oficial.

- Ficha do cliente no `public/qr.html`: troca do campo `Status` agora salva automaticamente a ficha, atualiza o pedido quando houver `orderId`, sincroniza com o Painel Unificado e recarrega metricas/listas.
- Pedidos `confirmed` agora gravam `confirmedAt` quando o status muda para confirmado. O bloco "Pedidos confirmados do periodo" usa `confirmedAt`/`createdAt` antes de `updatedAt`, evitando que pedido antigo reapareca como confirmado de hoje apenas por ter sido ressincronizado.
- Sincronizacao com Painel Unificado respeita leads arquivados como `finalizado`; registros finalizados nao devem voltar automaticamente para `confirmado`, `pedido_enviado` ou `enviado` por sync antigo.
- Limpeza segura no VPS em `/opt/maxlien-mvp/leads_ec.sqlite3`: 597 registros EC antigos com status `confirmado`, `pedido_enviado` ou `enviado` foram arquivados como `finalizado`.
- Backup do banco antes da limpeza: `/opt/maxlien-mvp/backups/leads_ec_before_confirmed_cleanup_20260520_231855.sqlite3`.
- Lista local para conferencia manual: `exports/admin-cleanups/leads_ec_confirmed_cleanup_phones_20260520_231855.csv`.
- Validacao: `npm run senior:check` local OK; `official:audit` local OK com avisos de API/Mongo local desligados e DNS do subprocesso SSH; VPS `health` OK; `https://maxlien.shop/qr.html` HTTP 200; Browser confirmou `customerStatusInput`, `confirmedDropdownPanel`, autosave no HTML, zero previews proibidos em `.chat-preview .meta`.
- Auditoria complementar da distribuicao VSL/WhatsApp: VSL usa `/api/whatsapp/vsl-entry`, pool efetivo EC `553183002800,553171862958,553183002800` enquanto `5515991418416` estiver desconectado. Hotfix aplicado para Purchase CAPI de WhatsApp enviar `messaging_channel=whatsapp` e para fechamento manual por `#fechado`/`#pedido_confirmado`/`#venda_concluida` pausar o funil por longo prazo sem enviar o codigo ao cliente.

### Dropi EC envio automatico

Status: validado localmente ate o bloqueio por saldo.

Hotfix VPS 2026-06-05:

- `public/leads-window.html` no VPS oficial foi ajustado para enviar pedidos Dropi com `async: true`, evitando que o painel fique preso/504 e garantindo que a rota grave `dropi_submit_queued` antes do Playwright terminar.
- Backup antes do hotfix: `/opt/vitalismen-automacao/current/public/leads-window.html.bak_dropi_async_true_20260605_185541`.
- Validacao: `https://maxlien.shop/leads-window.html` servindo `body: JSON.stringify({ async: true })`; `node --check src/routes/shipments.js` OK; `npm run senior:check` no VPS OK.
- Observacao: `EC-ADMIN-2061` e `EC-ADMIN-2050` estavam autorizados e com tentativa marcada, mas sem Dropi/guia/erro; apos o hotfix, reenviar pelo painel deve entrar na fila assincrona.

Hotfix complementar VPS 2026-06-05:

- `src/services/droppiEcuadorBrowserService.js` passou a pular a revalidacao de duplicidade para `EC-ADMIN-*` dentro de `checkDropiSubmitSafety`, inclusive apos o reload do pedido no Mongo depois do lock.
- Motivo: `EC-ADMIN-2061` entrou corretamente na fila assincrona, mas a segunda checagem perdeu `_adminLeadVirtual` e bloqueou por espelho WhatsApp `EC-MQ14RIZF-G3L6`.
- Backup antes do hotfix: `/opt/vitalismen-automacao/current/src/services/droppiEcuadorBrowserService.js.bak_admin_safety_20260605_191152`.
- PM2 reiniciado com `pm2 restart vitalismen-automation --update-env` e `pm2 save`.
- Validacao: `node --check src/services/droppiEcuadorBrowserService.js` OK; `npm run senior:check` no VPS OK.
- `EC-ADMIN-2061` liberado novamente com backup em `/opt/vitalismen-automacao/current/backups/dropi_unstick_after_admin_safety_20260605_191254`.

Pedidos testados:

- `1612`: `GUAYAS/Guayaquil via SERVIENTREGA`
- `1613`: `AZUAY/Camilo Ponce Enriquez via GINTRACOM`
- `1601`: `Santo domingo de los tsachilas/Santo Domingo via SERVIENTREGA`
- `1583`: `CARCHI/San Gabriel via SERVIENTREGA`
- `1576`: `Pichincha/Quito via SERVIENTREGA`
- `1573`: `GUAYAS/Naranjal via SERVIENTREGA`

Resultado esperado sem saldo:

```text
dropi_payment_required
```

Nao refazer esse fluxo do zero. Se precisar mexer, ajustar em:

- `src/services/droppiEcuadorBrowserService.js`
- `src/routes/shipments.js`
- `public/qr.html`

### Painel integrado

Status: primeira integracao local criada.

Entrada principal:

```text
http://127.0.0.1:3001/
```

Ela redireciona para:

```text
/qr.html
```

O painel local tem modulos:

- Integrado
- Atendimento
- Vendas / Dropi
- Equipe

Nao criar outro painel separado sem antes justificar por que o painel integrado nao atende.

Regra fixa do painel estilo WhatsApp:

- A coluna esquerda (`#chatList`, `.chat-item`, `renderChats`) e somente lista de contatos/conversas.
- Nessa coluna podem aparecer avatar, nome/telefone, horario e selos operacionais.
- Texto de mensagem, ultimo recado, transcricao, caption ou preview nunca deve aparecer junto ao numero na coluna esquerda.
- Mensagens devem aparecer somente no painel central (`#conversation`, `renderMessages`) depois de selecionar o contato.
- E proibido renderizar `chat.lastMessage.body` dentro de `.chat-item`, `.chat-preview`, `.chat-title` ou `.chat-foot`.
- A lista de clientes e metricas do painel Vitalismen devem ser filtradas pela sessao oficial conectada da Vitalismen.
- Nao exibir contatos de outros projetos, aquecimento, `status@broadcast`, grupos `@g.us` ou IDs `@lid` sem telefone real resolvido.
- Se o painel mostrar mais de um bot, seguir `docs/REGRA_ISOLAMENTO_BOTS_E_SEGURANCA.md`: cards e status podem aparecer juntos, mas chats, bancos, filas, funis e memorias operacionais nao podem ser misturados.
- Automacao nao responde grupos: chats `@g.us`, `status@broadcast`, canal, comunidade, lista de transmissao e ID tecnico sem telefone real devem ser ignorados como resposta automatica.

Validacao obrigatoria antes de publicar painel:

```js
document.querySelectorAll('.chat-preview .meta').length === 0
```

Tambem selecionar um contato e confirmar que as bolhas de mensagem aparecem no painel central.

Validar tambem que IDs tecnicos como `212...@lid` ou `206...@lid` sem telefone real nao aparecem como cliente.
