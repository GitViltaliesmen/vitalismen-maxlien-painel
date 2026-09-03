# V79 — attestation de prontidão do núcleo operacional EC

Data: 2026-08-29
País e sistema: Vitalismen Ecuador
Estado: candidata local atestada; sem push, tag, stage, deploy, ativação ou canário

## Objetivo e ancestralidade

A V79 sucede a V78 sem reescrever sua implementação funcional e sem alterar
nenhum arquivo histórico V78. A identidade pai é:

- commit `9a17abbe6546819f25885541a86f0cca7be1bc7b`;
- tree `a2d39450f790a3516ddfaed3babc1250927bb77b`;
- manifesto SHA-256
  `46a9363f203c9e2f4d574e286d2c361b4bd3bb915ee2f0b2398b04af624e12e1`;
- freeze SHA-256
  `b4fd1275fc7316cf63df103cade6c00ff322ef2b092f5083f79aed3e349039c3`.

Esta microcamada contém somente evidence, attestation, readiness e guards. O
perfil funcional continua sendo `EC_BOT_CORE_OPERATIONAL` da V78. A semântica
de `deployment.ready=true` significa apenas que os dois blockers externos
foram comprovadamente resolvidos e que a candidata pode avançar, depois de
nova autorização explícita, para publicação/deploy controlado e canário do
único telefone QA. Ela não executa nem autoriza essas ações nesta missão.

## Identidade canônica do Dataset

O Dataset compartilhado e autorizado do EC é
`1468946114265008`. A prova combina fontes independentes:

1. manifesto V78;
2. decisão V73, que congela `legacyEcDatasetPreserved` nesse ID e preserva o
   fallback legado quando o registry físico ainda não existe;
3. decisão V74, que congela `currentEcDatasetId` nesse ID e exige igualdade
   Browser/CAPI;
4. freezes Meta EC anteriores de Purchase, attribution bridge, funnel events,
   pretraffic e fast-state;
5. `.env` ativa root-only do runtime EC, lida de forma redigida;
6. resolução efetiva do CAPI EC por `getMetaConfigForCountry('EC')`;
7. descritor público redigido
   `GET https://ec.maxlien.shop/api/health/meta-destination`.

Na produção observada, o arquivo físico
`/opt/vitalismen-automacao/shared/config/meta-destinations.json` ainda não
existe e o descritor informa `source=legacy_env`. Isso não é uma divergência:
é o fallback explicitamente preservado pela V73. O destino ativo, o CAPI e o
descritor público resolvem todos `1468946114265008`; o descritor retorna
`browserServerSynchronized=true`, `available=true` e apenas o booleano
`tokenConfigured=true`. Nenhum token, secret, bearer ou binding foi registrado
nos artefatos V79.

O ID `1449537519948374` tinha somente duas evidências: a chave preexistente
`META_PIXEL_ID_PROTOCOLO` no host da VSL e o resolvedor público dessa VSL antes
da correção. Ele não aparece nas decisões do repositório EC, no CAPI ativo, no
destino ativo nem no descritor público EC. A classificação fechada é, portanto,
`VSL_BROWSER_STALE`.

## Correção mínima da VSL

Somente `META_PIXEL_ID_PROTOCOLO` foi alterada em `/opt/cloaker/.env`, de
`1449537519948374` para `1468946114265008`. A comparação antes/depois comprovou
354 linhas em ambos os arquivos e exatamente uma linha/chave modificada.

- SHA-256 anterior:
  `0811b2db6cd40c4ab5a83c778ab371cf91c0819fbe8cafdf0e997cf63ab332c2`;
- SHA-256 final:
  `9bb6146995aab6877be953f8d77e9d5ed44b780acdbad3282dc8ce06093aef70`;
- backup root-only:
  `/opt/cloaker/.backups/protocolo-meta-v79-20260829T182450Z`;
- diretório de backup `0700`, arquivo de backup `0600` e `.env` final
  `root:root 0600`;
- único processo recarregado: `cloaker` no host da VSL.

Nenhum token ou secret foi editado ou impresso. O bot EC, a Hostinger EC,
`/current`, PM2 `vitalismen-automation`, banco, WhatsApp, Z-API, Dropi,
schedulers e infraestrutura operacional estrangeira não foram modificados.

Os ativos da CTA permaneceram byte-idênticos:

- `public/protocolo.html`:
  `a8c6ab5b0f38f6f7b25e97cf8e36a1388fbc8519ada5622ae84840bcaa7101a7`;
- `public/assets/js/tracking.js`:
  `4febcc4964571d96fed81340610ffa7e68e61cd1a24e901b8bc9e18f00c9e2c5`.

## Provas públicas finais

O resolvedor público da VSL retorna exatamente:

```json
{"pixelId":"1468946114265008","pixelIds":["1468946114265008"]}
```

A validação elegível e somente leitura de
`https://vilaliemen.shop/protocolo` comprovou:

- HTTP `200`;
- `X-Cloaker: allowed`;
- destino `5515991418416`;
- mensagem
  `Hola, vengo de la presentación oficial de Tex Ultra. Ref: EC-TEX-ULTRA-PROTOCOLO`;
- marcador `EC-TEX-ULTRA-PROTOCOLO`.

O navegador integrado recebeu a página alternativa do cloaker e bloqueou a
abertura direta do endpoint JSON; por isso essa sessão não foi usada como prova
do conteúdo elegível. A prova elegível veio do HTTP público executado no host
oficial da VSL, sem executar JavaScript, clicar na CTA, abrir WhatsApp ou enviar
mensagem.

## Contagens Meta e ausência de emissão

O endpoint final fornece um único ID único e `pixel.js` chama uma única função
de carregamento. Os dois call sites sintáticos de `fbq('init', ...)` são ramos
mutuamente exclusivos para o mesmo item do loop; com um ID resolvido, a
inicialização lógica é uma. Nenhum Pixel paralelo foi introduzido.

O contrato V74 preservado comprova:

- uma definição CAPI `event_name: 'Purchase'`;
- quatro consumidores históricos guardados, todos chamando a mesma função
  CAPI e preservando seus locks;
- zero caminho Browser Purchase;
- um fluxo lógico Lead, deduplicado por `eventID`/`event_id`.

Nenhum evento Meta foi emitido: `META_EVENTS_SENT=0`.

## Política V79

O estado estrutural atestado é:

```text
CTA_ORIGIN_BLOCKER=RESOLVED
DATASET_BLOCKER=RESOLVED
DATASET_RECONCILIATION=PASS
BROWSER_CAPI_EQUALITY=PASS
VSL_PUBLIC_ORIGIN_CONFORMANCE=PASS
V79_DEPLOYMENT_READY=YES
BOT_CORE_ATOMIC_PROFILE=READY
MUTATING_SCHEDULERS_DEFAULT=BLOCKED
DROPI_APPLY_DEFAULT=BLOCKED
META_PURCHASE_DEFAULT=BLOCKED
```

`deployment.ready=true` não autoriza clientes reais, tráfego comercial amplo,
scheduler mutante, Dropi APPLY ou Meta Purchase. Também não cria permit, não
reseta QA e não ativa o bot.

O único contrato para um canário futuro permanece:

- telefone `5515998038637`;
- contexto `EC_V78_OFFICIAL_VSL_QA`;
- URL `https://vilaliemen.shop/protocolo`;
- `NEW_INBOUND=1`;
- `PANEL_CAPTURE=1`;
- `AUTO_RESPONSE=1`;
- `DUPLICATE_RESPONSE=0`.

Para executar aliases ancestrais que abrem processos Node separados, a V79
protege o preloader local
`scripts/lib/ec-bot-core-readiness-v79-successor-context.mjs`. Ele valida as
identidades dos manifestos V78/V79 e reconstrói somente o contexto process-local
de `declaredAncestorOverrides`; não importa o runtime guard, não inicia child
process, não altera ambiente operacional e não autoriza efeitos externos. O
preload é conservado apenas enquanto o CLI do npm encadeia scripts; ao entrar em
qualquer processo Node alvo, ele mantém o contexto já carregado e remove apenas
o próprio preload de `NODE_OPTIONS` antes que fixtures criem subprocessos. Isso
preserva o isolamento sintético e evita tanto o falso negativo de guards crus
quanto a recarga recursiva em harnesses.

## Artefatos e rollback

Evidência sanitizada:
`docs/evidence/ec-meta-dataset-reconciliation-v79-20260829.json`, SHA-256
`6bff2507362862bb28363f6d2d4637788f59344242d934ccd34a72a79a9bfb2f`.

Attestation sanitizada:
`docs/evidence/ec-bot-core-readiness-attestation-v79-20260829.json`, SHA-256
`a1682f2c975f158bb8e8b39d2fdf0660ae3be294b101fc844261d9da235f8439`.

O rollback da única mudança externa desta missão é restaurar a `.env` pelo
backup root-only registrado e recarregar somente `cloaker`. Esse rollback não
deve ser executado enquanto o Dataset EC canônico continuar
`1468946114265008`, pois recriaria a divergência Browser/CAPI.

Próximo passo: aguardar autorização explícita para publicação/deploy controlado
da sucessora e canário QA de telefone único.
