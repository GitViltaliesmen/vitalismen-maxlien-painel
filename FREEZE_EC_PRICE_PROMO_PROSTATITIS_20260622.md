# Freeze EC - Preco Generico 1/3/6 e Prostatitis - 2026-06-22

## Problema

Cliente perguntava preco/valor do produto sem escolher quantidade. O audio correto `TRATAMENTO_Y_PRECIOS_PROMOCAO` podia sair, mas algumas camadas ainda podiam mandar texto como se o cliente tivesse pedido `1 frasco`.

Tambem faltava reconhecer a frase escrita pelo cliente: `Sirbe para la prostatitis`.

## Correcao

- Pergunta generica de preco sem quantidade agora forca texto de promocao completa 1/3/6.
- O plano de saida tambem forca audio `TRATAMENTO_Y_PRECIOS_PROMOCAO`.
- Audio especifico de quantidade, como `1_BOTELLA_POR_39`, fica permitido somente quando o cliente pedir quantidade clara.
- Na etapa `sdr_awaiting_value_confirmation`, se o cliente perguntar preco sem quantidade, o bot:
  - envia audio `TRATAMENTO_Y_PRECIOS_PROMOCAO`;
  - envia texto com 1/3/6;
  - volta para aguardar escolha de quantidade;
  - limpa quantidade anterior para nao carregar `1 frasco` por engano.
- `Sirbe para la prostatitis`, `sirve para la prostatitis`, `prostatitis`, `prostata` e `próstata` entram como duvida de prostata.
- Audio esperado: `Ajuda_Prostata` quando a camada de complemento atua.

## Arquivos Alterados

- `src/services/conversationEngine.js`
- `src/services/openaiService.js`
- `src/services/vitPowerAudioComplementService.js`
- `src/services/vitPowerEvolvedWorkflow.js`

## Backup

- `backups/ec-price-prostata-layer-20260622/conversationEngine.js`
- `backups/ec-price-prostata-layer-20260622/openaiService.js`
- `backups/ec-price-prostata-layer-20260622/vitPowerAudioComplementService.js`
- `backups/ec-price-prostata-layer-20260622/vitPowerEvolvedWorkflow.js`

## Provas

- `node --check src/services/conversationEngine.js`
- `node --check src/services/openaiService.js`
- `node --check src/services/vitPowerAudioComplementService.js`
- `node --check src/services/vitPowerEvolvedWorkflow.js`
- `node --check src/services/audioTemplateService.js`
- Simulacao `Q valor tiene`: forca texto promocao 1/3/6 e audio `TRATAMENTO_Y_PRECIOS_PROMOCAO`.
- Simulacao `Y cuánto está el producto`: forca texto promocao 1/3/6 e audio `TRATAMENTO_Y_PRECIOS_PROMOCAO`.
- Simulacao `quiero 1 frasco`: mantem fluxo especifico de 1 frasco.
- Simulacao `precio de 3 frascos`: nao trata como preco generico.
- Simulacao `Sirbe para la prostatitis`: classifica como `symptom_question`.
- Confirmado arquivo de audio existente: `public/media/templates/EC/Ajuda_Prostata.ogg`.

## Regra Final

Se o cliente perguntar preco, valor ou promocao sem quantidade explicita, nunca responder como pedido de 1 frasco. Sempre enviar a promocao completa 1/3/6 e perguntar qual deseja reservar.
