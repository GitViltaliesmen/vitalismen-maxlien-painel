# Freeze V23 — identidade oficial Ana Lopez

Data: 2026-08-18

Estado: candidato local aprovado para publicacao, ainda nao publicado.

## Decisao do operador

Toda comunicacao do atendimento EC passa a usar `Ana López`, do time da Dra. Maria Fernandes, em Tex Ultra, Nitrix e Vit Power. O nome da persona desativada e removido do runtime, dos guards operacionais e dos ativos publicos. Mensagens antigas ja persistidas no banco nao sao reescritas; apresentacoes anteriores sao reconhecidas somente pela estrutura generica da mensagem.

Em 2026-08-18, o operador registrou nesta conversa o aceite explicito da identidade Ana Lopez e da biblioteca de audios ativa. Esse aceite libera o gate local de publicacao; nao constitui commit, push, merge, deploy ou autorizacao para alterar producao.

## Saidas ativas

- prompts, primeira resposta, follow-up administrativo, mensagens de envio, salvamento de contato, recusa de chamada e painel usam Ana Lopez;
- o painel mostra o avatar textual `AL`, porque nenhuma foto oficial de Ana existe no repositorio ou na URL publica e a imagem anterior retornava HTTP 404;
- a voz sintetica fica fail-closed: sem `ELEVENLABS_VOICE_ID_ANA_LOPEZ`, nenhum TTS e gerado;
- os dois pares MP3/OGG Nitrix cujo nome identifica a persona anterior foram removidos da biblioteca, do perfil, do painel, da extensao e do diretorio publico;
- quando um job Nitrix antigo ainda tentar executar essa etapa, ele e marcado como `legacy_identity_audio_quarantined` sem envio.

## Gate de publicacao

O repositorio nao possui transcricao confiavel de todos os audios genericos ativos. O risco foi apresentado ao operador, que aprovou expressamente o audio universal Tex Ultra e a biblioteca ativa. O manifesto registra esse aceite e o assert de publicacao passa somente enquanto os hashes protegidos e a politica aprovada permanecerem integros. Renomear arquivo continua nao sendo aceito como prova do conteudo falado.

## Preservado

- produtos, precos, pedidos, Dropi, Meta/CAPI, pixel e banco;
- bloqueios anti-spam, locks persistentes e historico de envio;
- transporte Z-API/WhatsApp e scheduler;
- nenhuma mensagem, pedido ou evento externo durante desenvolvimento;
- producao, PM2, `current`, Nginx e Cloudflare.

## Rollback

Antes de publicacao, descartar a branch e retornar ao commit base `46a81f5fe5f0dc89cc41353ae5eacefce08e82a5`. Depois de eventual publicacao, promover novamente a release anterior somente pelo helper transacional oficial.
