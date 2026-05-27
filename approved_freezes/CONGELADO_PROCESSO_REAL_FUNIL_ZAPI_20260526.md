# Congelado - Processo real funil Z-API Vit Power

Data: 2026-05-26

Status:

- Publicado no VPS em `/opt/vitalismen-automacao/current`.
- PM2 `vitalismen-automation` reiniciado e online.
- Este congelamento representa o ponto real de teste do dia. Nao esta perfeito, mas fica travado para testar na pratica sem mexer nas camadas aprovadas.

## Camadas protegidas

### Memoria e contexto

Base:

- `CONGELADO_FUNIL_CONTEXTO_HUMANO_ZAPI_20260526_1052.md`
- `CONGELADO_FUNIL_MEMORIA_FORTE_NOME_20260526.md`

Regras congeladas:

- Manter `lastFunnelStage`, `principalSdrStage`, `lastQuestionSent` e `pendingCheckoutOrder` como memoria principal do funil.
- Confirmacoes curtas devem usar contexto e nao reiniciar funil.
- Nome confiavel nao deve ser perdido nem sobrescrito por cidade, agencia, confirmacao ou endereco.
- Se o cliente responder algo fora do esperado, o bot deve tentar continuar da etapa certa, sem voltar tudo.

### Referencia e domicilio

Base:

- `CONGELADO_DOMICILIO_ENDERECO_FORMATADO_REFERENCIA_20260526.md`
- `CONGELADO_FUNIL_ATE_NOME_DOMICILIO_2_FRASCOS_20260526.md`

Regras congeladas:

- Domicilio exige endereco completo e referencia cercana.
- Ao escolher domicilio, enviar audio aprovado de orientacao e depois texto de apoio.
- O texto ativo deve ser pensado para Equador/espanhol, nao Brasil/portugues.
- Referencias aceitas no contexto do Equador:
  - `frente a`
  - `cerca de`
  - `cerca del`
  - `diagonal a`
  - `junto a`
  - `al lado de`
  - `por el sector de`
  - `a la altura de`
  - `farmacia`
  - `tienda`
  - `gasolinera`
  - `iglesia`
  - `parque`
  - `escuela`
  - `colegio`
  - `UPC`
  - `mercado`
  - `supermercado`
- Texto de apoio congelado para domicilio:

```text
Entiendo, señor 👍

Si no puede retirar en agencia, entonces envíeme por favor:

- dirección completa
- barrio o sector
- referencia cercana (farmacia, tienda, gasolinera, iglesia, parque o escuela cercana)

para revisar entrega a domicilio.
```

### Cidade e provincia

Regra congelada:

- O bot deve aceitar erros comuns de cidade/provincia do Equador.
- Exemplos aceitos para Guayaquil/Guayas:
  - `guayaquil`
  - `guayquil`
  - `guaykil`
  - `guayakil`
  - `guaiaquil`
  - `quayaquil`
  - `gauayas`
  - `guaias`
  - `guayas`
- Quando a frase vier como `vivo en...`, essa parte deve ter prioridade sobre rua, bairro ou referencia.
- `ciudad: Guayquil y provincia: Guayas` deve virar `GUAYAQUIL / GUAYAS`, nao salvar o texto inteiro como cidade.

### Nao repeticao

Regras congeladas:

- Usar dedupe de outbound para bloquear texto repetido.
- Usar `lastQuestionSent` e `lastFunnelStage` para nao repetir pergunta ja feita.
- Usar `principalSdrStage` para continuar da etapa correta.
- Depois de pedido fechado, usar trava pos-fechamento para nao reabrir funil nem mandar preco novamente.
- Se cliente disser `gracias`, `ok`, `listo`, `cuando llega mi guia`, ou duvidas simples pos-fechamento, responder sem reiniciar venda.

### Camada 2 frascos

Base:

- `CONGELADO_CAMADA_2_FRASCOS_SOB_PEDIDO_20260526.md`
- `CONGELADO_CAMADA_2_FRASCOS_FLUXO_OFICIAL_20260526.md`

Regras congeladas:

- Oferta oficial continua 1, 3 e 6 frascos.
- 2 frascos nao deve ser apresentado diretamente.
- Se o cliente pedir 2 frascos, responder valor e seguir fechamento.
- Confirmacoes ruidosas como `ai, correcto`, `ok correcto`, `si correcto` devem avancar quando o contexto for confirmacao.

## Arquivos criticos

- `src/services/conversationEngine.js`
- `src/services/servientregaEcuadorAgencyService.js`
- `src/services/vitPowerEvolvedWorkflow.js`
- `src/services/vitPowerAudioComplementService.js`
- `src/whatsapp/outboundGuard.js`

## Estado do teste

- Numero piloto limpo: `553183002800`.
- Ultima limpeza removeu:
  - 1 estado de conversa
  - 18 mensagens
  - 0 pedidos alterados

## Observacoes

- Esta camada foi congelada por decisao operacional para testar na realidade.
- Nao mexer em memoria/contexto, referencia/domicilio, nao repeticao, pos-fechamento ou 2 frascos sem abrir novo congelamento.
- Se cair conversao no teste real, analisar historico antes de alterar regra. Nao refatorar o funil inteiro.
