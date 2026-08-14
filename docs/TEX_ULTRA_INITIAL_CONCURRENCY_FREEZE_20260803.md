# Congelamento da cadência inicial concorrente Tex Ultra

Status: **APROVADO E CONGELADO EM 2026-08-03**

Escopo exclusivo: camada inicial `tex_ultra_ec`.

## Evidência aprovada pelo operador

O teste real do telefone final `8637` entregou a sequência completa e foi aprovado com a leitura aproximada:

1. áudio 01: `0:20`;
2. áudio 02: `0:29`;
3. prova social: `0:50`;
4. frasco Tex Ultra: `1:22`;
5. valores de 1, 2, 3 e 6 frascos: `1:56`.

Os registros persistidos da Z-API mostraram aproximadamente `0:18`, `0:29`, `0:50`, `1:20` e `1:54` até a entrega. A diferença é apenas de arredondamento e atualização visual do WhatsApp.

## Regra de concorrência aprovada

- Cada contato recebe um fluxo e um conjunto de temporizadores próprios.
- Um novo contato não espera a sequência completa do contato anterior.
- Contatos que entram juntos avançam em paralelo, preservando a ordem individual: áudio 01, áudio 02, prova, frasco e valores.
- Apenas a chamada curta de envio ao provedor passa pela fila global anti-colisão; a espera humana entre as etapas não ocupa essa fila.
- A janela de entrada conjunta permanece em 20 segundos para garantir que todos os contatos da mesma onda recebam os dois áudios antes das mídias comerciais.
- A cadência individual continua variável e cumulativa entre 97 e 128 segundos. Não transformar os tempos aprovados em uma fila sequencial por cliente.

Uma simulação conservadora com 50 contatos distribuídos na janela de 20 segundos deve terminar teoricamente em até 148 segundos a partir do primeiro contato. O comportamento proibido seria somar 128 segundos por contato, chegando a 6.400 segundos.

## Arquivos e validações

- Manifesto: `docs/freeze/tex-ultra-initial-concurrency-v3.json`.
- Teste da cadência: `node scripts/test-tex-ultra-initial-cadence.mjs`.
- Teste de concorrência: `node scripts/test-tex-ultra-initial-concurrency.mjs`.
- Trava do congelamento: `node scripts/guard-tex-ultra-initial-concurrency-freeze.mjs`.

## Imutabilidade

Não alterar sequência, intervalos, prova 1-de-4, frasco, valores ou paralelismo por contato sem nova aprovação explícita, novo manifesto, novos testes e nova versão de congelamento. Pós-venda, Dropi, fechamento, Nitrix e Vit Power permanecem fora deste escopo.
