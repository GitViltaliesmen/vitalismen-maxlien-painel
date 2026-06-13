# Mapa de Audio e Imagem

## Audios existentes para testar primeiro

```text
TRATAMENTO_Y_PRECIOS_PROMOCAO
3_BOTELLAS_POR_95_E_99
6_BOTELLAS_POR_167_E_99
FUNCIONA_VIT_POWER
FUNCIONA_TRATAMENTO_COMPLETO_100_NATURAL
DEPOIMENTO_AUDIO_PRODUTO
PERGUNTA_AGENCIA_DOMICILIO
ESCOLHA_UMA_AGENCIA_ACIMA
Agradecimento_Agencia_01
BONUS_RETIRADA
DOMICILIO
QUANDO_CLIENTE_PEDIR_A_DOMICILIO_REFERENCIA_COMPLETA
ENDERECO_ERRADO
COMO_SE_TOMA_VIT_POWER
TEMPO_RESULTADO_VIT_POWER
ENVIO_AGENCIA_100_SEGURO
ENTREGA_SEGURA_RETIRE_NA_AGENCIA
```

Observacao: `1_BOTELLA_POR_39` esta aprovado no codigo, mas o arquivo fisico nao foi encontrado no inventario local. Criar antes de usar.

## Midias existentes

```text
public/media/sales/ec/vit_power.jpeg
public/media/sales/shared/social_01.jpeg
public/media/sales/shared/social_02.jpeg
public/media/sales/shared/social_03.jpeg
public/media/sales/shared/social_04.jpeg
public/media/sales/shared/prova_social_video_boquet.mp4
```

## Novos audios sugeridos, 5 versoes cada

Padrao:

```text
NOME_DO_AUDIO_01
NOME_DO_AUDIO_02
NOME_DO_AUDIO_03
NOME_DO_AUDIO_04
NOME_DO_AUDIO_05
```

Lista:

```text
FAST_PRECO_PROMOCAO_01..05
FAST_QUERO_1_CONFIRMAR_01..05
FAST_QUERO_3_CONFIRMAR_01..05
FAST_QUERO_6_CONFIRMAR_01..05
FAST_FUNCIONA_DIRETO_01..05
FAST_FIRMEZA_RENDIMIENTO_01..05
FAST_CIDADE_PEDIR_01..05
FAST_AGENCIA_PERGUNTAR_01..05
FAST_AGENCIA_ESCOLHER_01..05
FAST_NOME_COMPLETO_01..05
FAST_PEDIDO_CONFIRMADO_01..05
FAST_BONUS_RETIRADA_FOTO_01..05
FAST_DOMICILIO_PEDIR_ENDERECO_01..05
FAST_ENDERECO_CONFIRMAR_01..05
FAST_SEGURANCA_ENTREGA_01..05
FAST_RECUPERACAO_CURTA_01..05
```

## Onde cada audio entra

| Estado/intencao | Audio atual | Audio futuro |
| --- | --- | --- |
| pergunta preco/promocao | `TRATAMENTO_Y_PRECIOS_PROMOCAO` | `FAST_PRECO_PROMOCAO_01..05` |
| quer 1 frasco | criar `1_BOTELLA_POR_39` | `FAST_QUERO_1_CONFIRMAR_01..05` |
| quer 3 frascos | `3_BOTELLAS_POR_95_E_99` | `FAST_QUERO_3_CONFIRMAR_01..05` |
| quer 6 frascos | `6_BOTELLAS_POR_167_E_99` | `FAST_QUERO_6_CONFIRMAR_01..05` |
| pergunta se funciona | `FUNCIONA_VIT_POWER` | `FAST_FUNCIONA_DIRETO_01..05` |
| desejo sexual direto | `FUNCIONA_TRATAMENTO_COMPLETO_100_NATURAL` | `FAST_FIRMEZA_RENDIMIENTO_01..05` |
| pedir cidade | `NOME_CIUDAD_PROVICINCIA` | `FAST_CIDADE_PEDIR_01..05` |
| perguntar agencia/domicilio | `PERGUNTA_AGENCIA_DOMICILIO` | `FAST_AGENCIA_PERGUNTAR_01..05` |
| escolher agencia | `ESCOLHA_UMA_AGENCIA_ACIMA` | `FAST_AGENCIA_ESCOLHER_01..05` |
| pedir nome | nenhum especifico | `FAST_NOME_COMPLETO_01..05` |
| pedido confirmado | `Agradecimento_Agencia_01` | `FAST_PEDIDO_CONFIRMADO_01..05` |
| bonus retirada/foto | `BONUS_RETIRADA` | `FAST_BONUS_RETIRADA_FOTO_01..05` |
| domicilio | `DOMICILIO` | `FAST_DOMICILIO_PEDIR_ENDERECO_01..05` |
| confirmar endereco formatado | `ENDERECO_ORIENTACAO` | `FAST_ENDERECO_CONFIRMAR_01..05` |
| seguranca entrega | `ENVIO_AGENCIA_100_SEGURO` | `FAST_SEGURANCA_ENTREGA_01..05` |

## Imagens futuras

Criar depois, por etapa:

1. Produto oficial limpo.
2. Precos 1/3/6.
3. Bonus/retirada.
4. Entrega segura Servientrega.
5. Prova social discreta.

Imagens de preco entram apenas quando o cliente fala de preco, promocao, tratamento, valor ou quantidade.
