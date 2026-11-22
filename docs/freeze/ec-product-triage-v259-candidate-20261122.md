# Candidata V259 — triagem de produto EC

Estado: candidata local, sem publicação. A referência curta Tex da V258 permanece candidata e não deve ser ativada na página antes do receptor oficial do bot.

## Escopo

- Entrada Z-API de cliente EC que pede Tex Ultra, Nitrix Oxide, Vit Power ou variantes explícitas `Text Ultra` e `NT Power`: permitir a resposta informativa da microcamada V39 e gravar somente o produto solicitado na ficha, respeitando o bloqueio de escolha manual do operador.
- Entrada genérica sem produto reconhecível, como `Hola, quiero el tratamiento`: perguntar uma vez qual dos três produtos deseja, sem presumir produto, preço ou origem de VSL.
- A liberação do modo manual vale apenas para o estado de captura criado pela Z-API e sem operador atribuído. Atendimento humano real, opt-out, risco, país fora do EC, grupo e testes protegidos conservam os bloqueios existentes.
- A origem histórica da VSL e o fluxo comercial de cada produto permanecem separados. A V258 cuida apenas da referência individual Tex; esta mudança não gera eventos Meta nem pedidos.

## Verificação

- `node --test tests/ec-product-triage-v259.test.mjs`: 3 testes passaram.
- `node --check` dos dois serviços alterados, `git diff --check` e simulação V258: passaram.
- Teste integrado V39/V258 em Linux: os 11 testes V243/V258 passaram; V39 não iniciou porque o ambiente de QA não possui `/usr/local/lib/vitalismen-deploy/gira21x-sealed-successor-v1.mjs`. Este resultado não valida a integração V39.
- Hashes dos três arquivos Plusmen em produção em 22/11/2026 continuam iguais às preimagens do manifesto V258. O bot Hostinger ainda executa o release anterior.

## Gates antes da ativação

Registrar sucessor selado oficial para os arquivos de bot e Plusmen, testar a rota de entrada e envio autenticados sem disparar conversa comercial fictícia, comparar hashes, fazer backup, ativar primeiro o receptor do bot e depois a referência Tex, validar o release PM2 e os assets públicos. Não enviar eventos Meta ou WhatsApp sintéticos para comprovar atribuição. Se qualquer gate falhar, manter o release anterior e esta candidata sem publicação.
