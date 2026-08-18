# Freeze V22 — abertura Tex Ultra e leitura do painel

Data: 2026-08-18

Estado: candidato local, nao publicado.

Sucessao: a identidade exclusiva desta camada foi ampliada para toda nova comunicacao EC pelo freeze V23 `docs/EC_ANA_IDENTITY_FREEZE_V23_20260818.md`.

## Autorizacao e causas confirmadas

O operador autorizou substituir a abertura do Tex Ultra que enviava os audios de manha e tarde juntos, preceder o audio por uma mensagem personalizada com nome e periodo do Equador e corrigir o contador de mensagens nao lidas que reaparecia.

As duas causas foram localizadas no codigo ativo da base de producao:

- o perfil, a cadencia automatica e o bloco manual declaravam dois audios iniciais distintos e os enviavam sequencialmente;
- o painel zerava localmente a conversa selecionada sem persistir toda nova leitura, descartava erros do POST e o backend usava somente um alias/horario ao calcular nao lidos.

## Contrato Tex Ultra

- A abertura usa o fuso `America/Guayaquil`: 05:00–11:59 `buenos dias`, 12:00–17:59 `buenas tardes` e 18:00–04:59 `buenas noches`.
- A mensagem usa o nome validado quando houver e nunca envia telefone ou o placeholder `[NOMBRE]` como nome.
- A identidade `Ana Lopez / Dra. Maria Fernandes` desta mensagem e uma excecao explicita e exclusiva do Tex Ultra solicitada pelo operador; nao altera Nitrix ou Vit Power.
- A ordem e: saudacao personalizada, um unico audio universal, prova, frasco e oferta.
- A cadencia mantem lock persistente, `sendingAt`, `sentAt`, fila de envio, interrupcao por nova mensagem e pausa segura apos restart.
- O perfil e o painel apontam somente para `CONHECER_NECESSIDADES_CLIENTES` como candidato de audio universal.
- O conteudo falado desse arquivo ainda exige escuta e aceite humano antes de publicacao; o guard registra `audioHumanApprovalRequired=true`.

## Contrato de mensagens nao lidas

- O marcador considera todos os aliases conhecidos do telefone (`@lid`, `@c.us`, `@s.whatsapp.net`, `phoneDigits`, `lastSenderPn` e telefone da ficha).
- O backend grava o horario da leitura e o timestamp da ultima mensagem recebida visivel naquele instante.
- O modo rapido agrega o marcador mais recente de todos os aliases, sem escolher uma copia antiga.
- Uma conversa aberta persiste a leitura quando o polling observa nova entrada; falha do POST nao e mais descartada silenciosamente em acao explicita.
- O GET de conversas continua somente leitura. A unica escrita desta correcao permanece no POST autenticado `/api/whatsapp/chats/read`.

## Preservado

- produto oficial Tex Ultra da rota `/n/` e precos 1/2/3/6;
- Nitrix e Vit Power, inclusive seus blocos e identidades;
- Dropi, Meta/CAPI, pixel, scheduler, chamadas e transportes;
- bloqueio de replay automatico depois de restart;
- nenhuma mensagem, pedido ou evento externo nos testes;
- producao, banco oficial, PM2, `current`, Nginx e Cloudflare.

## Rollback

Antes de publicacao, descartar esta branch e voltar ao commit base `46a81f5fe5f0dc89cc41353ae5eacefce08e82a5`.

Depois de eventual publicacao, criar uma nova release imutavel do commit anterior e usar somente o helper transacional oficial com rollback para a release anterior. Nao editar a release ativa ou o symlink manualmente.
