# Ponte Meta entre VSL e WhatsApp - 2026-08-14

## Evidencia antes da correcao

- 91 eventos `Purchase` foram aceitos pela Meta (`events_received: 1`).
- Somente 8 tinham `fbc`, `fbp`, `fbclid` ou UTM.
- 2 tinham apenas `sourceUrl`, que nao identifica anuncio ou criativo.
- 81 estavam totalmente sem identificador de origem.
- A VSL registrava os identificadores do anuncio, mas a entrada do WhatsApp recebia o telefone sem receber o identificador da visita.
- A ponte antiga dependia de telefone coletado na VSL; a pagina ativa nao coleta telefone do cliente.
- Na amostra historica das frases A/B atuais, 18 de 19 entradas tiveram exatamente uma visita atribuivel nos 120 segundos anteriores; uma ficou sem candidata e seria preservada sem atribuicao.

## Correcao conservadora

- A VSL, o player, o CTA, as duas frases A/B e o destino `5515991418416` permanecem inalterados.
- Ao receber a primeira mensagem pela integracao atual, o backend procura uma visita com:
  - mensagem normalizada exatamente igual;
  - clique ocorrido nos 120 segundos anteriores;
  - `fbc`, `fbp`, `fbclid` ou UTM presentes.
- A ligacao so e gravada quando existe exatamente uma candidata.
- Zero candidatas ou mais de uma candidata resultam em nenhuma atribuicao; o atendimento continua normalmente.
- A visita recebe o telefone do contato e o pedido confirmado reutiliza a ponte existente por telefone.
- `sourceUrl` isolada deixa de ser tratada como prova de atribuicao e nao bloqueia o enriquecimento por visita.
- As duas frases A/B ativas passam a ser reconhecidas como entrada Tex Ultra; antes apenas a frase A era reconhecida explicitamente.

## Preservado

- Nenhum evento antigo e reenviado.
- Nenhum pedido e alterado ou reenviado ao Dropi.
- Nenhuma mensagem e enviada ao cliente durante a instalacao.
- O `Purchase` continua exclusivo de pedido confirmado, com valor positivo e trava anti-duplicidade.
- A integracao atual do WhatsApp permanece conectada e responsavel pela captura de entrada.

## Rollback

Retornar para a release congelada anterior e reiniciar somente o processo da aplicacao. Os campos novos de auditoria em `VslVisit` sao opcionais e nao impedem a leitura pela versao anterior.
