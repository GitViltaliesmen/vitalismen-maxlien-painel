# Recongelamento do Funil Vit Power

Data: 2026-05-25

Status: fechado, publicado e recongelado.

## Camadas fechadas neste ciclo

1. Rodizio de provas sociais no funil inicial oficial:
   - `social_01`
   - `social_02`
   - `social_03`
   - `social_04`
   - `DEPOIMENTO_AUDIO_PRODUTO`

2. Camada lateral de ingredientes:
   - borojó;
   - chontaduro;
   - noni;
   - L-arginina;
   - maca;
   - guaraná;
   - vitaminas.

3. Camada de saude sensivel:
   - se o cliente mencionar pressao, diabetes, coracao, remedios, cirurgia, rim, figado, alergia ou contraindicacao, o bot envia texto curto de cuidado e o audio aprovado `100_NATURAL_SEM_CONTRA_INDICACAO`.

## Regras preservadas

- Nao alterado preco.
- Nao alterada quantidade.
- Nao alterada agencia Servientrega.
- Nao alterado fechamento.
- Nao alterado envio Dropi.
- Nao ativada variacao curta para cliente frio.
- Funil inicial oficial continua na ordem aprovada.

## Validacao

- `node --check src/services/conversationEngine.js`: OK.
- `node --check src/services/funnelPurposeMemoryService.js`: OK.
- `node --check src/services/vitPowerAudioComplementService.js`: OK.
- `node scripts/senior-guard.mjs`: OK.
- VPS health: online.
- WhatsApp: 3 sessoes conectadas.
- `degradedReasons`: vazio.

## Arquivos de referencia

- `src/services/conversationEngine.js`
- `src/services/funnelPurposeMemoryService.js`
- `src/services/vitPowerAudioComplementService.js`
- `docs/CONGELAMENTO_RODIZIO_PROVAS_SOCIAIS_FUNIL_INICIAL_2026-05-25.md`
- `docs/CAMADA_INGREDIENTES_VIT_POWER_2026-05-25.md`

