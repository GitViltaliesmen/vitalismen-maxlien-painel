# Entrada Tex TX243 no WhatsApp vinculado — candidata V267

Data: 2026-11-24. Escopo: somente a entrada Tex Ultra publicada pela CTA de `plusmen.shop/tex` no bot EC.

## Falha reproduzida

A CTA publicada envia `Hola, quiero el tratamiento Tex Ultra.` seguida de `Referencia: TX243-` e 64 caracteres hexadecimais. O `agentRouter` reconhece a referência e escolhe Tex, mas passa o corpo original ao agente. A exceção V249 que prioriza o funil exige texto sem referência e sessão `zapi`. No transporte vinculado `default`, o respondedor direto assume a mensagem e escolhe `product_information` antes do funil Tex. Esta é uma reprodução em memória, não uma afirmação de perda de mensagens reais.

## Delta candidato

- `src/services/texUltraLinkedEntryV267Service.js`: identifica somente a mensagem TX243 exata em contexto Tex EC automático, com identidade de inbound e sessão coerentes.
- `src/services/conversationEngine.js`: para essa entrada, deixa o respondedor direto passar ao funil Tex existente. Perguntas de preço, outros produtos, bloqueio humano e mensagens sem referência válida mantêm as rotas anteriores.
- `tests/tex-linked-entry-v267.test.mjs`: casos positivos e negativos sem envio externo.

Nenhuma VSL, número, pixel, campanha, pedido, Dropi, mensagem real ou arquivo do release ativo foi alterado. O sucessor Git parte diretamente do commit ativo `002292ab`.

## Verificação

- Staging isolado: `/opt/vitalismen-automacao/staging/tex-linked-entry-v267`, criado a partir do release ativo, com os três arquivos candidatos aplicados. Não é `/current`.
- Testes focados em Linux: 12/12 passaram para entrada TX243, medição do dispositivo vinculado, isolamento multiproduto e interrupção da cadência.
- A simulação V267 executou o trecho real de roteamento do `conversationEngine` e a função real de entrada do `texUltraFunnelService` em memória: TX243 alcançou a primeira camada uma vez; pergunta de preço permaneceu no respondedor direto. Os módulos de envio e persistência foram substituídos por dublês locais. Nenhum contato, pedido ou evento externo foi criado.
- Guard de microcamada EC: passou.
- `npm run senior:check`: falhou em `.github/workflows/ec-panel-quality.yml` por divergência V47. A mesma falha ocorre no release ativo sem este delta. Um teste V249 de hash ancestral também falha no release ativo.
- PM2 `vitalismen-automation`: online e ainda no release `20261124T015510Z_production-20261124-002292a`; saúde local HTTP 200.
- A tentativa com o publicador oficial para o commit candidato foi recusada com `identidade/preload da release não autorizado`: o registro selado atual conhece a V265, não a V267. O publicador descartou a release incompleta; `current` e PM2 não mudaram. A autoridade V265 permanece intacta para rollback.

## Estado e próximo gate

**CANDIDATA VALIDADA PARCIALMENTE; NÃO PUBLICADA.** Para ativar, alinhar os gates ancestrais por sucessor legítimo sem modificar o comportamento congelado, emitir autoridade selada própria para o delta V267, repetir testes no release materializado, fazer backup e executar canário com o telefone de QA. Só declarar resolvido após uma nova entrada TX243 receber a primeira etapa do funil uma vez e persistir no painel após recarga.
