# Freeze V28 — Customer Identity, Location & Delivery Data Resolution

Data: 2026-08-18
Estado: candidato local validado, publicação e ativação não autorizadas
Pai: `tex-ultra-vsl-payload-v27-20260818`

## A. Diagnóstico

A V27 extraía corretamente `Nombre`, `CIUDAD` e `PROVINCIA`, mas a persistência posterior aceitava qualquer texto não vazio como dado operacional. Isso permitia usar `miguelarellanoperalta` como nome final, não distinguia pista de perfil de informação explícita, não registrava proveniência por campo e podia iniciar a escrita de pedido no painel antes de validar a qualidade da ficha.

## B. Arquitetura

O pipeline V28 é determinístico:

`EXTRACT -> PRESERVE RAW -> NORMALIZE -> STRUCTURAL VALIDATION -> CANONICAL RESOLUTION -> CROSS-CHECK -> CONFIDENCE -> CONFIRM/LOCK -> ORDER GATE -> SAVE`

A IA não decide se uma cidade, província ou agência existe. O catálogo local autorizado decide. Serviço geográfico externo permanece opcional, desligado e não utilizado nesta versão.

## C. Schema final

`ContactState.customerDataResolution` e `Order.customerDataResolution` guardam versão, país, campos com proveniência, conflitos, score, `orderDataReady`, motivos de bloqueio, próximo campo e data da avaliação. `Order.delivery` guarda `mode`, `agencyId` e `agencyName`. O schema é aditivo e não remove dados legados.

Cada campo crítico conserva `raw_value`, `canonical_value`, `display_value`, `source`, `source_message_id`, `extracted_at`, `confidence`, `validation_status`, `confirmed_by_customer`, `corrected_by_human`, `locked`, evidências e histórico limitado de versões anteriores.

## D. Name Resolver

O resolvedor suporta Unicode, acentos, `ñ`, hífen, apóstrofo, partículas, nomes compostos, dois sobrenomes e monônimos plausíveis/confirmados. Não exige dois tokens. Nome de perfil é apenas pista. Número, emoji, URL, e-mail, texto comercial e repetição anormal são inválidos.

Concatenação com múltiplos sinais recebe `SEGMENTATION_REQUIRED`; nenhum espaço é inventado. O valor bruto permanece auditável e não vira nome canônico do pedido.

## E–F. Location e Province Resolvers

O registro EC é derivado deterministicamente das 591 agências autorizadas, com 219 cidades únicas e 24 províncias. O resolver remove qualificadores como `Ecuador`, aceita alias explícito, aplica fuzzy somente com candidato único acima do limiar e deriva a província de cidade canônica única. `Ambatto` resolve para `Ambato / Tungurahua`; `Ambato / Guayas` vira `LOCATION_CONFLICT`.

## G. Reference Resolver

Referência bruta e normalizada são preservadas. `place_candidate`, latitude e longitude permanecem vazios quando não há prova geográfica. O adapter externo está preparado por feature flag, não é obrigatório e não foi acionado.

## H. Agency Resolver

Somente `src/data/agencia_LISTA.json` autoriza agência operacional. O identificador é um hash estável dos dados do catálogo. Correspondência fora da cidade/província vira conflito; sugestão ambígua não gera `agencyId`. Como o catálogo atual não contém coordenadas, busca por proximidade declara honestamente `authorized_registry_coordinates_unavailable` e nunca escolhe por semelhança textual como se fosse distância.

## I–J. Confidence e conflitos

Score 0–100 é explicável e separado do estado. Conflito crítico nunca é ocultado pelo score. Os estados são `VERIFIED`, `HIGH_CONFIDENCE`, `CANONICAL`, `AUTO_FROM_CITY`, `NEEDS_CONFIRMATION`, `SEGMENTATION_REQUIRED`, `CONFLICT`, `INVALID`, `MISSING`, `UNVERIFIED_TEXT` e `NOT_APPLICABLE`.

## K. Human Override

Campo corrigido e salvo explicitamente pelo operador recebe `corrected_by_human=true` e `locked=true`. Confirmação explícita do cliente também ganha lock sobre inferências, mas não supera uma correção humana já fixada. Um lock nunca transforma cidade ou agência inexistente em dado válido.

## L. Order Data Gate

Pedido não pode ser confirmado nem disparar Purchase nas rotas cobertas sem nome resolvido, telefone EC válido, país EC, cidade canônica, província coerente, modalidade de entrega e endereço domiciliar ou agência autorizada conforme o modo. O painel executa preflight antes de qualquer escrita de pedido; backend do painel, rotas de pedido e funil Tex Ultra repetem o gate.

## M. UX

A ficha mostra modalidade, agência autorizada, estado de oito campos, score, motivos de bloqueio e ação de correção do nome. Para concatenação, o botão apenas orienta/foca o campo até que haja separação explícita; depois do salvamento humano, o nome fica bloqueado contra sobrescrita automática.

## N–O. Testes e regressão

Cobertura dedicada: `tests/customer-data-resolution-v28.test.mjs` e `tests/customer-data-resolution-v28-integration.test.mjs`. A regressão inclui V27, V26, painel read-only, produto EC, Meta, Dropi e scripts inline. Nenhum teste dedicado envia WhatsApp, cria pedido real, chama Dropi ou Meta.

Resultado local final: `npm run senior:check` aprovou 171/171 testes, o guard sênior, a cadência de 90–112 segundos e a simulação concorrente de 50 contatos. `npm run official:path`, o guard da microcamada de produto, o isolamento Tex Ultra e as 19 regras do freeze lock também passaram. O assert de publicação V28 permaneceu fail-closed com saída 78, como previsto para candidato não autorizado.

## P. Riscos

- O catálogo autorizado não possui coordenadas; proximidade geográfica real permanece indisponível.
- Pedidos legados sem `delivery.mode` precisam de revisão/migração antes de nova confirmação pelo gate V28.
- O catálogo de localidades deriva das agências e deve receber manutenção versionada quando o operador atualizar a fonte oficial.
- A V28 amplia schema, painel e rotas; exige staging e teste controlado antes de qualquer publicação.

## Q. Plano de deploy futuro

Somente após autorização escrita específica: gerar tag/commit imutáveis, rodar guards, staging sem envio, validar migração aditiva, testar um contato autorizado, obter permit root de uso único, ativar transacionalmente, validar `pm_cwd`/`pm_exec_path`, health local/oficial, `/n/` e Z-API. A autorização de V26 ou qualquer outra versão não pode ser reutilizada.

## R. Rollback

Reapontar `CURRENT` para a release anterior pelo helper transacional, recriar somente `vitalismen-automation` se PM2 ainda apontar para release incorreta e validar health, `/n/` e Z-API. Os subdocumentos aditivos podem permanecer no Mongo sem uso; não apagar evidências.

## Aprovação de freeze, commit e staging

Em 2026-08-18, o operador aprovou expressamente o freeze, o commit imutável e o staging local isolado da V28, limitado aos casos sintéticos A–D. A autorização não inclui push, PR, deploy, ativação, produção, mensagem real, pedido real, Dropi, Meta/CAPI, alteração do catálogo ou geocodificação externa. A publicação continua fail-closed até nova autorização escrita específica.

## Preservado

VSL, player, campanhas, Meta/Pixel/CAPI, transporte Z-API, preços, produtos, mídias e minutagem/cadência permanecem sem alteração funcional. Nenhum deploy, mensagem real, pedido real, evento Meta, Dropi, PM2, symlink ou banco de produção foi alterado.
