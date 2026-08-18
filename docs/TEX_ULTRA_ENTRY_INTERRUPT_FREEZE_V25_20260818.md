# Freeze V25 — abertura variada e interrupcao Tex Ultra

Data: 2026-08-18

Estado: candidato local aprovado pelo operador para publicacao, ainda nao publicado.

## Decisao aprovada

A frase de entrada permanece:

`Hola, [NOMBRE], [PERIODO]. Soy Ana López, asistente de la Dra. María Fernandes. Vi su mensaje y será un gusto atenderle personalmente. Estoy aquí para ayudarle. ¿En qué puedo ayudarle?`

Somente um emoji discreto e colocado antes de `Hola`. O rodizio oficial e `👋`, `😊`, `🙂`, `🙏`, `✅`, sem repeticao consecutiva durante o processo ativo.

## Cadencia preservada

- abertura: 2–6 segundos depois da entrada;
- audio universal: 4–8 segundos depois da abertura;
- prova: 21–25 segundos depois do audio;
- frasco: 28–33 segundos depois da prova;
- oferta: 35–40 segundos depois do frasco;
- total teorico: 90–112 segundos.

## Interrupcao soberana do cliente

- uma nova mensagem cancela os timers restantes;
- a fila confere novamente a existencia da nova entrada imediatamente antes do envio;
- preco, quantidade e modo de uso seguem respostas deterministicas do Tex Ultra;
- outra pergunta grava atendimento humano, envia uma confirmacao curta e nao retoma as midias automaticamente;
- somente um pedido explicito para continuar pode reconstruir as etapas ainda nao enviadas.

## Preservado

- Tex Ultra Ecuador e sua tabela oficial;
- um unico audio universal aprovado;
- prova e frasco oficiais;
- memoria, locks e antirrepeticao;
- Nitrix e Vit Power isolados;
- pedidos, Dropi, Meta/CAPI, pixel e numero WhatsApp;
- producao, PM2, `current`, servicos e banco oficial.

## Validacao

Os testes sao locais e nao enviam WhatsApp:

- `tests/tex-ultra-entry-interrupt-v25.test.mjs`;
- `tests/tex-ultra-entry-unread-v22.test.mjs`;
- `scripts/test-tex-ultra-initial-cadence.mjs`;
- `scripts/test-tex-ultra-initial-concurrency.mjs`.

## Autorizacao de publicacao

Em 2026-08-18T14:12:47Z, o operador autorizou expressamente o deploy controlado da V25 para teste exclusivo no telefone `5515998038637`. A autorizacao libera a preparacao, commit, tag, staging e ativacao pelo helper transacional; nao permite contornar permit root, guards, rollback ou validacoes de health.

## Rollback

Enquanto nao publicado, descartar somente o diff V25 e retornar ao commit `d8ea5f0efbc96a6b4c9fd536aae4b485e9c52743`. Qualquer publicacao futura continua dependente do deploy transacional oficial e de autorizacao separada.
