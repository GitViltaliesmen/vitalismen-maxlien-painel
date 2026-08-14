# Operacao local

Pasta oficial do projeto:

```sh
cd "/Users/greson/Documents/Vitalismen Automacao"
```

Branch/frente unica local para consolidar o funil antes de deploy:

```text
codex-vitpower-unified-front
```

Regra: trabalhar localmente nessa frente, validar com auditoria e so subir ao VPS com `npm run deploy:vps` quando estiver pronto.

## Ordem para ligar

1. Abrir o terminal na pasta oficial.
2. Subir o MongoDB local:

```sh
./scripts/start-mongo-local.sh
```

3. Em outro terminal, subir a API:

```sh
./scripts/start-api-local.sh
```

4. Abrir o painel do WhatsApp:

```text
http://127.0.0.1:3001/qr.html
```

5. Verificar a API:

```sh
./scripts/check-health-local.sh
```

6. Rodar a auditoria oficial de retomada/finalizacao:

```sh
npm run official:audit
```

Tambem existem atalhos equivalentes:

```sh
npm run local:mongo
npm run local:api
npm run local:health
```

## Estado encontrado em 2026-05-03

- MongoDB local estava rodando em `127.0.0.1:27017`.
- API nao estava rodando em `127.0.0.1:3001`.
- Banco local continha dados: `shipments`, `messages`, `orders`, `contactstates`, `products` e `users`.
- Sessao WhatsApp local encontrada: `auth_info_baileys/5515991418416`.
- Existem muitas mudancas locais ainda nao commitadas.
- Decisao operacional: manter somente Equador.
- Os audios antigos de contexto externo ficam removidos.
- Atencao: `EC/Chegou_01`, `EC/Chegou_02` e `EC/Chegou_03` foram revisados para manter somente material validado do Equador.
- Os novos `Chegou_01`, `Chegou_02` e `Chegou_03` do Equador foram instalados e convertidos para `.ogg`.
- Ambiente local com audios liberados: `SHIPMENT_NOTIFICATIONS_ENABLED=true` e `SHIPMENT_EC_PICKUP_AUDIO_APPROVED=true`.
- Historico de teste manual: em 2026-05-03 foi usado `DISABLE_SCHEDULER=1` para subir a API sem automacoes periodicas.
- Estado operacional registrado em 2026-05-08: `.env` local com `DISABLE_SCHEDULER=0`, `BOT_FORCE_AGENT=vit_power_ec`, `WHATSAPP_AUTO_REPLY_ENABLED=true`, `WHATSAPP_FUNNEL_ENABLED=false` e `BOT_USE_APPROVED_AUDIO_ONLY=true`.
- Sessao WhatsApp antiga com erros `Bad MAC` foi arquivada fora da pasta ativa:
  `.local/whatsapp-session-backups/5515991418416.backup-badmac-20260504-0018`
- A pasta ativa de sessao agora deve conter somente:
  `auth_info_baileys/5515991418416`

## Checklist antes de mexer

1. Confirmar que esta na pasta oficial com `pwd`.
2. Verificar o estado do Git com `git status --short --branch`.
3. Ligar MongoDB e API usando os scripts oficiais.
4. Abrir `http://127.0.0.1:3001/qr.html`.
5. Conferir se o WhatsApp esta conectado, escaneando ou deslogado.
6. Rodar `npm run official:audit`.
7. Antes de salvar um novo marco do projeto, fazer um teste manual controlado do fluxo alterado.
8. Depois do teste manual aprovado, manter `DISABLE_SCHEDULER=0` para operar automaticamente; usar `DISABLE_SCHEDULER=1` somente para reparo/teste controlado.

## Checklist para finalizar e voltar depois

Ao finalizar uma rodada:

1. `npm run senior:check`
2. `npm run official:audit`
3. registrar no resumo:
   - PID/porta da API local, se ficou rodando;
   - status do WhatsApp;
   - ultima mensagem/pedido testado;
   - se VPS passou no `senior:check`;
   - quais arquivos foram alterados.
4. Atualizar ou ler o resumo mais recente de retomada:

```text
docs/RETOMADA_2026-05-09.md
```

Ao voltar ao projeto:

1. entrar em `/Users/greson/Documents/Vitalismen Automacao`;
2. ler `docs/RETOMADA_2026-05-09.md`;
3. rodar `npm run official:audit`;
4. se houver falha, corrigir a falha antes de continuar desenvolvimento;
5. se houver apenas aviso de API desligada, subir Mongo/API e repetir a auditoria.

## Repareamento limpo do WhatsApp

Quando aparecerem muitos erros `Bad MAC`, `No matching sessions` ou `failed to decrypt message`, o caminho correto e:

1. Parar a API.
2. Mover a sessao atual para fora de `auth_info_baileys/`, mantendo backup em `.local/whatsapp-session-backups/`.
3. Subir a API com `DISABLE_SCHEDULER=1`.
4. Abrir `http://127.0.0.1:3001/qr.html`.
5. Escanear o QR no WhatsApp.
6. Confirmar que o painel mostra apenas uma sessao ativa, `5515991418416`, com status `connected`.
7. Fazer teste manual controlado antes de religar scheduler.

## Pontos que precisam de decisao

- Fazer um teste manual dos novos audios de Equador antes de operar em volume.
- Reativar o scheduler somente depois do teste manual aprovado.
- Confirmar se os novos servicos de Dropi Ecuador estao prontos para virar commit.
- Confirmar se a pasta `.codex-tmp/` deve ficar apenas como rascunho local e fora do Git.
- Depois da validacao, criar um commit com um nome claro para congelar este estado.
