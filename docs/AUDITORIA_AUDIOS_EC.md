# Auditoria dos audios do Equador

Data: 2026-05-03

## Decisao atual

O projeto deve permanecer configurado para Equador.

Por enquanto, manter apenas os audios de Equador em `public/media/templates/EC/`.

## Arquivos ativos encontrados

- `Inicio_01.mp3`
- `Inicio_01.ogg`
- `Inicio_02.mp3`
- `Inicio_02.ogg`
- `Chegou_01.mp3`
- `Chegou_01.ogg`
- `Chegou_02.mp3`
- `Chegou_02.ogg`
- `Chegou_03.mp3`
- `Chegou_03.ogg`
- `BONUS_RETIRADA.mp3`
- `BONUS_RETIRADA.ogg`
- `CONFIRMACION_Y_REGALITO_ESPECIAL.mp3`
- `CONFIRMACION_Y_REGALITO_ESPECIAL.ogg`
- `PERGUNTA_AGENCIA_DOMICILIO.mp3`
- `PERGUNTA_AGENCIA_DOMICILIO.ogg`
- `ENDERECO_CIDADE_PROVINCIA_AGENCIA.mp3`
- `ENDERECO_CIDADE_PROVINCIA_AGENCIA.ogg`

## Instalacao dos novos audios

Os arquivos recebidos em `Downloads` foram instalados como audios ativos do Equador:

- `/Users/greson/Downloads/Chegou_01.mpeg` -> `public/media/templates/EC/Chegou_01.mp3`
- `/Users/greson/Downloads/Chegou_02.mpeg` -> `public/media/templates/EC/Chegou_02.mp3`
- `/Users/greson/Downloads/Chegou_03.mpeg` -> `public/media/templates/EC/Chegou_03.mp3`
- `/Users/greson/Downloads/BONUS_RETIRADA.mpeg` -> `public/media/templates/EC/BONUS_RETIRADA.mp3`
- `/Users/greson/Downloads/CONFIRMACION Y REGALITO ESPECIAL.mpeg` -> `public/media/templates/EC/CONFIRMACION_Y_REGALITO_ESPECIAL.mp3`
- `/Users/greson/Downloads/PERGUNTA_AGENCIA_DOMICILIO.mpeg` -> `public/media/templates/EC/PERGUNTA_AGENCIA_DOMICILIO.mp3`
- `/Users/greson/Downloads/ENDERECO-CIDADE-PROVINCIA-AGENCIA.mpeg` -> `public/media/templates/EC/ENDERECO_CIDADE_PROVINCIA_AGENCIA.mp3`

Apesar da extensao `.mpeg`, os arquivos sao MP3 validos, mono, 128 kbps, 44.1 kHz.

Foram geradas as versoes `.ogg` com codec Opus para envio via WhatsApp.

## Resultado tecnico

Os novos pares `mp3` e `ogg` de `Chegou` existem e possuem duracoes equivalentes:

- `Chegou_01`: 34.27 segundos
- `Chegou_02`: 51.17 segundos
- `Chegou_03`: 83.72 segundos
- `BONUS_RETIRADA`: 16.90 segundos
- `CONFIRMACION_Y_REGALITO_ESPECIAL`: 30.35 segundos
- `PERGUNTA_AGENCIA_DOMICILIO`: 25.50 segundos
- `ENDERECO_CIDADE_PROVINCIA_AGENCIA`: 15.41 segundos

## Resultado de origem anterior

Os arquivos abaixo foram comparados com material externo antigo no historico Git:

- `public/media/templates/EC/Chegou_01.mp3`
- `public/media/templates/EC/Chegou_01.ogg`
- `public/media/templates/EC/Chegou_02.mp3`
- `public/media/templates/EC/Chegou_02.ogg`
- `public/media/templates/EC/Chegou_03.mp3`
- `public/media/templates/EC/Chegou_03.ogg`

Conclusao: os arquivos estao na pasta do Equador, mas nao devem ser considerados audios verificados de Equador. Eles precisam ser substituidos por gravacoes corretas antes do uso em producao.

Depois da verificacao, esses arquivos foram movidos para quarentena local:

```text
public/media/templates/EC/.quarantine-context-copy/
```

Essa pasta fica fora do Git e fora da lista ativa de audios do Equador.

## Protecao aplicada

Enquanto os audios corretos nao estavam substituidos e validados:

```env
SHIPMENT_NOTIFICATIONS_ENABLED=false
SHIPMENT_EC_PICKUP_AUDIO_APPROVED=false
```

Mesmo que alguem use o botao manual de aviso de chegada no painel, o servico bloqueia o envio dos audios `Chegou` do Equador quando `SHIPMENT_EC_PICKUP_AUDIO_APPROVED` nao estiver `true`.

Depois da instalacao dos novos audios, o ambiente local ficou liberado:

```env
SHIPMENT_NOTIFICATIONS_ENABLED=true
SHIPMENT_EC_PICKUP_AUDIO_APPROVED=true
```

## Hashes atuais

```text
Chegou_01.mp3  f90e1cdb4120855f256c113b9f026a5b96d533b8bf02794b74a7b80176c28ccb
Chegou_01.ogg  a8da28c6b82f8b2577ba78e25f8bd0f5ec357a221b1b96fa3b743bf4177a8cdd
Chegou_02.mp3  1326c35fa0f22cc1e04941d076830c5efedec9b3a462672316f0bc73ed953150
Chegou_02.ogg  27ef08ab6c02c2670ede3883769d1ec0a8c64e058ab0a32d54dafe0cf826c419
Chegou_03.mp3  8cfa34b7939e94e9611fddce680a0afdbcbb6c1921df890a291c6884b86430e7
Chegou_03.ogg  971779e2a30b30ca57b0ef40d58372b4526e5b985682ed6eeab3d80649b92c5c
BONUS_RETIRADA.mp3  c215abb1041d13b3d6258c3be513036830f170d0b1d51d88ea42e184b4b8b3d6
BONUS_RETIRADA.ogg  d9929c5469fee53114fba65a7fc707a641042eec56ff271b70c08ca3e4fd5bdc
CONFIRMACION_Y_REGALITO_ESPECIAL.mp3  168da570f0abde18167c0fab5c5d5a8bc31e51f7e695afb65b0998e5232438ca
CONFIRMACION_Y_REGALITO_ESPECIAL.ogg  bfe02402b2dface8cead71e749c04d4b2c54f5d485982b0c5cf160fd5379ce40
PERGUNTA_AGENCIA_DOMICILIO.mp3  82af74b72fa595230fbbbd12c37100881e754e30b0173c73d1b8d27eb5a346d2
PERGUNTA_AGENCIA_DOMICILIO.ogg  2730023739c01acad79990959dc19d34de46601ebb1c361d50546f19b5656472
ENDERECO_CIDADE_PROVINCIA_AGENCIA.mp3  626062b45a3860541b928f771a72bcc77d297c2154f99ed953eca63e7b050f85
ENDERECO_CIDADE_PROVINCIA_AGENCIA.ogg  36eba6ab518e2111535bdd09d312a048d082b1875387eecbd20d0ff0e89f7472
```

## Proximo passo

1. Subir a API.
2. Abrir `http://127.0.0.1:3001/qr.html`.
3. Conferir a lista de audios do Equador no painel.
4. Fazer um teste manual controlado antes de deixar o scheduler operar sozinho.
