# V152-E-R3 — normalização BR/JID e gate de flush do auth state

Data: 2026-09-12

## Escopo autorizado

A R3 deriva exclusivamente da candidata R2 congelada no commit
`0aea21f5bf3760b09a694e4e3e6c70670cc4fc0d`. Ela corrige dois limites do helper
one-shot do canal `V152_TEST_WEB_01`: comparação da identidade brasileira
quando o endereço autenticado emitido pelo Baileys usa a representação histórica
sem o nono dígito e tratamento de `restartRequired` 515 somente depois da
persistência comprovada do auth state.

Nenhum QR, pairing code, socket real, mensagem, provider call, restart de PM2,
publicação ou cutover é autorizado por este freeze. A Z-API e a release ativa
permanecem intocadas.

## Identidade canônica

A entrada única de comparação é `compareCanonicalPhoneIdentity`. Ela separa:

- telefone configurado de entrada;
- E.164 canônico;
- JID base normalizado por `jidNormalizedUser`/`jidDecode` do Baileys;
- JID de dispositivo;
- telefone de exibição.

Igualdade numérica exata continua válida. A variante brasileira histórica
somente é aceita quando o próprio endereço de usuário/dispositivo foi observado
num contexto autenticado do Baileys e o `channelId` observado é exatamente o
autorizado. Sem essa evidência, a comparação falha fechada. Não existe DDD,
telefone ou transformação específica do canal dentro da função de normalização.

As linhas Z-API atual, anterior e QA continuam na lista proibida. A mesma prova
canônica é aplicada a cada bloqueio antes de validar o canal de teste, impedindo
colisão por representação de JID.

## Gate de restart 515

`V152EAuthFlushEventGate` registra `creds.update`, serializa todas as chamadas a
`saveCreds`, endurece a árvore da sessão, relê `creds.json` e exige a estrutura
mínima do Baileys 6.7.24. O restart só é liberado quando:

- a atualização com `account`, `me` e `signalIdentities` foi observada;
- todos os writes solicitados terminaram;
- não há write pendente;
- auth state em memória e persistido estão estruturalmente completos;
- o path resolvido continua sendo o namespace autorizado.

Depois do gate, o helper permite exatamente um novo socket com QR proibido. Um
segundo 515, QR inesperado ou qualquer falha de persistência encerra o fluxo. Não
há delay fixo nem retry ilimitado.

## Key store no primeiro restart

Para Baileys 6.7.24, o callback `pair-success` grava em creds `account`, `me`,
`signalIdentities` e `platform`. O login seguinte é selecionado pela presença de
`creds.me`; as chaves de sessão/pre-key do multi-file store são produzidas e
consumidas posteriormente durante a abertura e sincronização. Portanto:

- `KEY_STORE_REQUIRED_AT_515=NO`;
- `KEY_STORE_REQUIRED_BEFORE_RESTART=NO`.

A ausência do key store não relaxa a validação dos campos criptográficos e da
identidade presentes em `creds.json`.

## Sessão parcial inválida

O utilitário `scripts/v152-e-r3-partial-session-cleanup.mjs` aceita somente o
path literal `/var/lib/vitalismen-whatsapp-web-sessions/V152_TEST_WEB_01`, exige
root, owner `root:root`, modo `0700`, exatamente um `creds.json` regular `0600`,
zero subdiretórios, zero symlinks, confirmação do 401 e nenhum processo de
pairing/status. Antes da remoção, grava um receipt root-only somente com
metadados e `reason=loggedOut_401`.

A remoção usa `unlink` no único arquivo validado e `rmdir` no diretório exato;
não usa wildcard nem delete recursivo.

## Preservado

- produção Z-API `5531971862958` e seu tráfego;
- VSL, Pixel, CAPI e Funnel Metrics;
- lógica comercial do bot, painel core e pós-venda;
- `shadow=true`, `draining=true`, `weight=0`, `capacity=0`;
- roteamento de clientes, handoff, failover e cutover bloqueados;
- candidata R2 e release ativa sem alteração.

## Validação antes de novo QR

```sh
npm run guard:v152-e-r3
npm run test:v152-e-r3
npm run restart:sim:v152-e-r3
npm run test:v152-e
npm test
node scripts/run-with-v144-context.mjs senior:check
npm audit --omit=dev --audit-level=moderate
```

Um novo QR exige aprovação explícita separada do operador.
