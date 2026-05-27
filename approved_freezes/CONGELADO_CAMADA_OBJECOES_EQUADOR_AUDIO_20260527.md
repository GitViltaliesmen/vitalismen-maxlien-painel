# Congelado - Camada separada de objecoes Equador com audio

Data: 2026-05-27

Status:

- Publicado no VPS em `/opt/vitalismen-automacao/current`.
- PM2 `vitalismen-automation` reiniciado e online.
- Esta camada e complementar. Nao altera o funil principal congelado de preco, quantidade, domicilio, agencia, fechamento ou 2 frascos.

## Regra geral

- Objeções e perguntas fora da etapa principal devem ser respondidas pela camada `vitPowerAudioComplementService`.
- A camada usa cooldown por regra para evitar repetição.
- Depois de responder a objeção, o funil deve preservar a memoria para continuar da etapa correta.

## Objecoes configuradas nesta camada

### Demora, chegada e guia

Gatilhos:

- `Cuanto demora?`
- `Cuando llega?`
- `Cuando llega mi guia?`
- `Numero de guia`
- `Rastreo`

Resposta:

- Texto curto sobre guia e prazo.
- Audio: `TEMPO_DEMORA_PRODUTO_CHEGAR`.

### Prostata

Gatilhos:

- `prostata`
- `prostatico`
- `orina`
- sintomas urinarios

Resposta:

- Texto com cuidado medico.
- Audios: `Ajuda_Prostata`, fallback `PROSTADA_FUNCIONA_E_QUANDO_CHEGA`.

### Estafa, seguro, confiable

Gatilhos:

- `estafa`
- `golpe`
- `fraude`
- `seguro`
- `confiable`
- `confianza`
- `real`
- `verdad`
- `miedo`

Resposta:

- Provas sociais configuradas.
- Audios: `TEMPO_RESULTADO_VIT_POWER`, `DEPOIMENTO_AUDIO_PRODUTO`.

### Ligar, chamada e insistencia em chamada

Gatilhos:

- `te llamo`
- `puedo llamar`
- `llameme`
- `me llama`
- `conteste`
- `quiero hablar por llamada`

Resposta:

- Audios: `QUANDO_CLIENTE_INSISTE_EM_LIGAR`, `QUANDO_CLIENTE_LIGA_01`.

### Liquido, jarabe

Gatilhos:

- `jarabe`
- `xarabe`
- `es liquido`
- `viene en liquido`
- `frasco liquido`

Resposta:

- Audio: `Jarabe`.
- Arquivos publicados:
  - `public/media/templates/EC/Jarabe.mp3`
  - `public/media/templates/EC/Jarabe.ogg`

### De onde e o produto, origem, laboratorio

Gatilhos:

- `de donde es el producto`
- `origen del producto`
- `laboratorio`
- `quien lo fabrica`
- `donde lo hacen`

Resposta:

- Texto curto sobre Vit Power e equipe da doctora Maria Fernandes no Equador.
- Audio: `DUVIDAS`.

### Cobertura, cidade, Galapagos

Gatilhos:

- `Galapagos`
- `Galápagos`
- `Puerto Ayora`
- `Santa Cruz Galapagos`
- `San Cristobal`
- `Isabela`
- `Baltra`

Resposta:

- Audio: `GALAPAPOS_PUERTO_AYORA_NAO_FAZEMOS_ENTREGAS`.

### Cliente passou por cirurgia

Gatilhos:

- `cirugia`
- `cirugía`
- `operado`
- `operada`
- `operacion`
- `postoperatorio`
- `me operaron`
- `recien operado`

Resposta:

- Texto orientando prudencia e confirmacao com medico.
- Audio: `RECOMENDACOES_PARA_CLIENTE_QUE_PASSOU_POR_CIRURGIA_PROPOSTA`.

## Arquivo principal

- `src/services/vitPowerAudioComplementService.js`

## Observacao

- Esta camada nao deve apresentar preco nem reiniciar funil.
- Se uma objeção cair aqui, a etapa anterior deve permanecer na memoria para continuar o fechamento depois.
