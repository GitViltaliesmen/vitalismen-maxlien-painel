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

Comando de deploy protegido:

```sh
VITALISMEN_DEPLOY_CONFIRM=YES npm run deploy:vps
```

Esse comando:

- roda `official:audit` antes de subir;
- confere o `senior:check` do VPS legado;
- envia a versao local para `/opt/vitalismen-automacao/releases/<timestamp>`;
- nao copia `.env`, `auth_info_baileys`, `.local`, `node_modules` nem audios gerados;
- nao ativa o release automaticamente, salvo se for chamado com `VITALISMEN_DEPLOY_ACTIVATE=YES`.

Para ativar o release enviado:

```sh
VITALISMEN_DEPLOY_CONFIRM=YES VITALISMEN_DEPLOY_ACTIVATE=YES npm run deploy:vps
```

Mesmo ativando o symlink `/opt/vitalismen-automacao/current`, restart de PM2 continua sendo decisao explicita. Isso evita que uma versao local ainda em teste derrube producao.

## Estado atual registrado

### Dropi EC envio automatico

Status: validado localmente ate o bloqueio por saldo.

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
