# Freeze V78 — núcleo operacional seletivo e runtime mutável externo

Data: 2026-08-29
Freeze ID: `ec-bot-core-structural-safety-v78`
Versão: `V78`
Pai: `V77H2`
Estado: implementação estrutural local congelada; deploy bloqueado pela origem VSL pública

## Identidade ancestral

- `PARENT_COMMIT = 193faa1c919a02c524deba3263bc174b24775700`
- `PARENT_TREE = 124c6a0f46daf9f768014935a78bbba71c8f8d04`
- `PARENT_MANIFEST_SHA256 = 63e409d9bb72a109b2960ce1df24cc327e2ee97044d67e2eec0febb2a6b323d5`
- O commit e a tree resultantes são registrados no relatório Git posterior ao
  commit. Eles não podem ser autorreferenciados dentro do próprio objeto Git.

## Causas corrigidas

1. `runtime/passive-funnel-observer-latest.json` era produzido durante a
   execução dentro da release e alterava seu fingerprint funcional.
2. Não existia transição atômica para abrir somente o núcleo do bot mantendo
   schedulers, Dropi APPLY e Meta Purchase bloqueados.
3. O QA autorizado estava sob hold humano e a origem pública não gerava uma
   assinatura determinística de produto, interrompendo o roteamento antes do
   `agentRouter`.

## Contrato de artefato mutável

`src/services/mutableRuntimeArtifactV78Service.js` declara exatamente cinco
artefatos. Em release oficial, todos resolvem sob
`/opt/vitalismen-automacao/shared/runtime`; em desenvolvimento, sob `.runtime`.
Override relativo arbitrário, saída da raiz autorizada, traversal, symlink em
qualquer componente e artefato dentro da release são bloqueados.

O fingerprint exclui somente envelopes de publicação declarados na raiz. Ele
não exclui `runtime/`, `src/`, `package.json` ou diretório funcional amplo.
Assim, mudar o snapshot externo não muda a identidade funcional; mudar código,
configuração funcional, arquivo disfarçado ou artefato não declarado muda.

## Perfil `EC_BOT_CORE_OPERATIONAL`

O overlay versionado é único, canônico e hasheado. Ele libera somente:

- persistência de inbound e ACK Z-API;
- estado de conversa necessário ao roteamento;
- resposta automática pelo transporte Z-API oficial;
- estado do atendimento exibido no painel.

Rotas HTTP mutantes permitidas: três webhooks Z-API e as duas rotas existentes
de entrada VSL. Coleções Mongo permitidas: `contactstates`, `messages`,
`outbounddedupes`, `vslvisits` e `metaattributioncorrelations`. A allowlist é
aplicada somente dentro de uma rota V78 autorizada; fora desse contexto até uma
coleção permitida falha fechada.

Permanecem bloqueados:

- todos os schedulers mutantes e follow-ups;
- Dropi APPLY, sincronização ativa e envio de pedido;
- Meta/CAPI Purchase e qualquer evento de compra;
- pedidos, remessas, recompra, importações administrativas e segundo
  transporte;
- qualquer efeito externo fora de inbound, reply e estado de atendimento.

`ops/ec-bot-core-v78` oferece `plan`, `authorize`, `activate`, `status` e
`contain`. A autorização usa permit de uso único de até dez minutos. A
ativação futura valida release, fingerprint, manifesto, attestation, PM2, Z-API,
health e Dataset antes do único `restart --update-env`; a contenção usa o
comando V66 oficial. O helper não carrega `.env`, não duplica segredo e não
imprime token.

## Reset QA e hold humano

O reset aceita somente a string literal `5515998038637`; formato, parcial,
lista, sufixo ou outro número falham. Exige tags e metadados de teste já
existentes, permit SHA-256 temporário e registro `qaTestContextV78`.

A transição modifica apenas `human.mode`, `human.pausedUntil` e o contexto de
auditoria. Histórico, mensagens, pedidos, país, memória e
`publicVslLeadEntry` são preservados. A segunda aplicação é `noop`. Depois de
uma única mensagem identificada pelo ID do provider, o contexto é consumido.
A contenção restaura o hold anterior; se um operador real retomou
`human.mode=manual`, o reset não responde nem sobrescreve esse estado.

## Origem VSL

O reconhecedor exige conjuntamente URL canônica, destino oficial e mensagem
exata com o marcador `EC-TEX-ULTRA-PROTOCOLO`. Mensagem genérica, destino falso,
origem falsa e produto ambíguo são recusados. A entrada exata continua
compatível com o classificador Tex Ultra já congelado, sem criar bypass global
de `publicVslLeadEntry`.

A inspeção pública somente leitura registrada em
`docs/evidence/ec-official-vsl-origin-v78-20260829.json` encontrou a CTA atual
com destino `553172220518` e texto genérico `Hola, quiero el tratamiento`, em
vez do destino `5515991418416` e da assinatura exata. Reconhecer o texto
genérico seria inseguro. Por isso:

- `VSL_OFFICIAL_RECOGNITION_CONTRACT = PASS`
- `VSL_PUBLIC_ORIGIN_CONFORMANCE = FAIL_CLOSED`
- `DEPLOYMENT_READY = NO`
- `DEPLOYMENT_BLOCKER = OFFICIAL_VSL_ORIGIN_CONTRACT_DIVERGENT`

Nenhum conteúdo remoto foi alterado nesta missão.

## Dataset e isolamento

- `DATASET_ID = 1468946114265008`
- Browser e CAPI precisam apresentar o mesmo identificador no pre-health e no
  health ativo.
- Apenas a identidade sanitizada do Dataset permanece compartilhável.
- Bot, painel, banco, PM2, WhatsApp, Dropi e schedulers estrangeiros não são
  referenciados pelo runtime V78 e não foram acessados nem alterados.

## Provas e resultados

- `MUTABLE_RUNTIME_ARTIFACT_CONTRACT = PASS`
- `BOT_CORE_ATOMIC_PROFILE = READY`
- `MUTATING_SCHEDULERS_DEFAULT = BLOCKED`
- `DROPI_APPLY_DEFAULT = BLOCKED`
- `META_PURCHASE_DEFAULT = BLOCKED`
- `QA_RESET = READY`
- `HUMAN_HOLD_PROTECTION = PASS`
- `VSL_OFFICIAL_RECOGNITION = PASS` para a assinatura canônica
- `FINGERPRINT = PASS`
- `DATASET_CHANGED = NO`
- `PRODUCTION_MUTATIONS = 0`

Os gates obrigatórios são executados após a geração do manifesto e antes do
commit local. Qualquer falha invalida o commit e exige regenerar este freeze e
o manifesto.

Os guards estáticos V61–V63, V72, V73 e V76 foram alinhados ao mecanismo
sucessor: cada um aceita divergência ancestral apenas quando o manifesto
sucessor aplicável declara aquele arquivo como override e registra o hash exato
vigente. Não existe bypass por nome de versão, variável de ambiente ou ausência
de manifesto.

## Classificação exata

- `BUSINESS_LOGIC_PRODUCT_CHANGE = NO`
- `PRICE_CHANGE = NO`
- `CHECKOUT_CHANGE = NO`
- `VSL_CONTENT_CHANGE = NO`
- `DATASET_CHANGE = NO`
- `WHATSAPP_NUMBER_CHANGE = NO`
- `PRODUCTION_DEPLOYED = NO`
- `BOT_ACTIVATED = NO`
- `QA_TEST_EXECUTED = NO`

## Próxima fronteira autorizável

Primeiro corrigir a CTA da origem oficial para o destino e assinatura
congelados e confirmar a evidência pública. Somente depois, mediante autorização
explícita separada, publicar a sucessora sem blocker e executar deploy
controlado seguido do canário QA. Esta V78 não autoriza nenhuma dessas ações.
