# EC Traffic Restoration V171 — 2026-09-17

## Escopo autorizado

Microcamada exclusiva do Vitalismen / Maxlien Equador para restaurar o ingresso real da VSL Protocolo-G no painel e no primeiro inbound WhatsApp, corrigir o telefone QA `5515998038637` para Atendimento e permitir a ativação controlada do perfil `EC_BOT_CORE_OPERATIONAL` sem desligar a Z-API.

O canário vivo confirmou ainda que o telefone brasileiro do QA oficial precisa
ser correlacionado como contrato VSL EC somente quando passar pela allowlist
exata `5515998038637`. Essa exceção não altera a inferência de país de nenhum
cliente real e permanece protegida pelos mesmos permits temporários V78.

## Contrato preservado

- Z-API continua sendo o transporte público oficial.
- WhatsApp Web permanece somente em `SHADOW`; este freeze não gera QR, não troca provider e não encerra a Z-API.
- Dropi continua manual, `REPORT_ONLY`, sem submit automático.
- Meta Purchase permanece condicionado ao pedido Dropi novo e confirmado.
- Schedulers mutantes permanecem em zero.
- Tex Ultra, Nitrix e Vit Power conservam produto, áudio, preço e origem próprios.
- Nenhum telefone fictício é criado para o pré-lead.

## Mudança funcional pontual

1. Uma entrada válida da VSL sem telefone é persistida e projetada no painel como `VSL · TEX ULTRA — AGUARDANDO WHATSAPP`.
2. O primeiro inbound com mensagem exata e candidato único consolida a visita, tracking e produto no `ContactState`; ambiguidades falham fechadas.
3. O telefone QA termina sempre em `attendance`, inclusive se houver valor legado `engagement`, e pode aparecer em Novas quando houver não lida.
4. O gate `TRAFFIC_READY` somente passa com o núcleo V78 e suas rotas mínimas habilitados, strict read-only desligado, superfície global de mutação ainda fechada, VSL persistida, painel e autenticação válidos, schedulers zero e Dropi bloqueado para aplicação automática.
5. O helper V78 pode arquivar, com autorização literal e auditoria, um bundle consumido pertencente a uma release anterior; não para nem recria o PM2 durante o supersede.

## Validação obrigatória

```sh
npm run guard:traffic-restoration-v171
NODE_OPTIONS=--import=./scripts/lib/ec-runtime-successor-v97-context.mjs npm run senior:check
npm run guard:freeze-lock
```

Antes e depois do deploy também são obrigatórios `pm2 jlist`, `readlink -f /opt/vitalismen-automacao/current`, health oficial, canário QA e verificação autenticada do painel.

## Rollback

Reativar a release anterior pelo helper oficial de deploy e restaurar o snapshot Mongo criado antes da ativação somente se houver escrita de dados incompatível. A Z-API não deve ser desligada no rollback.
