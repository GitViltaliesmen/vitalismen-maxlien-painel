# Resultado da ativação V42 — comando e resposta local do AQUECIMENTO EC

Data: 2026-08-22
País: Equador
Status: ativa e validada em produção

## Fonte imutável

- Pull request funcional: `#47`.
- Commit funcional: `f6b77a01874574327457f9c0d501b4615123d2d9`.
- Merge em `production`: `cbd6dfcbf3f43c36ccfe2057ab79d32353d6a76d`.
- Tag anotada: `production-20260822-cbd6dfc`.
- GitHub Release: `V42 — fila e resposta local do Aquecimento EC`.
- Freeze: `ec-engagement-command-reply-v42-20260822`.

A branch `production`, a tag, o commit do staging e a release ativada apontavam
para a mesma árvore antes da autorização root.

## Staging e ativação transacional

- Release ativa:
  `/opt/vitalismen-automacao/releases/20260822T185502Z_production-20260822-cbd6dfc`.
- Somente `vitalismen-automation` foi reiniciado.
- PID anterior: `2181029`.
- PID atual após ativação: `2188070`.
- `current`, `pm_cwd`, `pm_exec_path` e o CWD real do PID resolvem para a V42.
- Estado PM2: `online`; `unstable_restarts=0`.
- Autorização root `0600` consumida em uso único.
- Rollback automático não foi executado.
- Release V41 preservada:
  `/opt/vitalismen-automacao/releases/20260822T180506Z_production-20260822-1f4895b`.

O helper oficial validou clone, tag, `npm ci`, estado oficial, freeze lock,
`senior:check`, microcamada de produtos, catálogo Dropi, retirada, contatos,
selos e testes antes da troca do symlink.

## Backup

- Arquivo oficial anterior:
  `/opt/vitalismen-automacao/backups/qr.html.before-v42-20260822T185502Z`.
- Permissão: `0600`.
- SHA-256:
  `dc3f6395f485064b7f858d4e4b63f8438c5d5a4404d8574d246e559c8a878e38`.

O release V41 completo também permanece disponível para rollback. Nenhum banco,
storage compartilhado, contato, pedido ou histórico precisa ser revertido.

## Resultado funcional

- o painel confia primeiro no bucket validado recebido do backend;
- `EC-ADMIN-*` histórico sem obrigação operacional não força mais `PEDIDOS`;
- pedido ou shipment ativo continua soberano em `PEDIDOS`;
- tags técnicas equivalentes continuam persistidas, mas somente uma etiqueta
  visual `AQUECE` é mostrada;
- `#AQUECE`, `#AQUECE#` e `/AQUECE` permanecem comandos internos equivalentes,
  idempotentes e nunca enviados ao cliente;
- somente contato aprovado manualmente recebe confirmação passiva local;
- `gracias`, emoji, saudação, imagem, sticker, áudio sem pergunta e link isolado
  recebem template curto sem pergunta;
- mídia e link não são abertos, analisados ou transcritos;
- nenhuma chamada de modelo de IA é feita;
- pergunta comercial, suporte, risco ou opt-out permanece fora da resposta
  passiva e segue para a fila operacional apropriada;
- atividade humana recente, debounce, cooldown, teto diário, lock, histórico e
  antirrepetição permanecem obrigatórios.

“Local” significa que a decisão e o texto são calculados no servidor sem serviço
externo de IA. A entrega da resposta ao WhatsApp continua necessariamente usando
o transporte oficial Z-API.

## Contato auditado em modo somente leitura

O contato `+593986247702`, José Virgilio Chanalata Nacevilla, foi conferido depois
da ativação sem gravar dados e sem enviar mensagem.

- bucket persistido: `engagement`;
- origem: `panel_command`;
- aprovação manual: `Administrador Maxlien`;
- horário da seleção: `2026-08-22T18:35:12.766Z`;
- pedidos ativos: `0`;
- shipments ativos: `0`;
- último envio automático de relacionamento: `null`;
- respostas diárias já enviadas: `0`;
- chamadas de modelo registradas: `0`;
- custo estimado de IA: `0`.

A auditoria histórica pura também apresentou `media_or_links_ambiguous` porque
31 das 41 entradas antigas são mídias. Isso não remove a seleção manual: o caminho
real do webhook reaplica `manual_engagement_preserved_without_exclusion` a cada
nova entrada quando não há risco, opt-out, suporte ou intenção comercial, e então
torna a resposta local elegível.

## Testes e validação pública

- testes V42/V41: `20/20` aprovados;
- regressão principal: `316/316` aprovada;
- lint: `LINT_JS_SYNTAX=OK files=364`;
- freeze lock: `19` regras preservadas;
- guard de produto EC: aprovado;
- GitHub Actions Node 20 e Node 22: aprovados;
- Cloudflare Pages: aprovado;
- staging oficial: todos os gates aprovados;
- health oficial: `status=online`, Z-API configurada e conectada;
- `https://ec.maxlien.shop/qr.html`: HTTP `200`;
- `https://ec.maxlien.shop/panel-intelligence/ec-engagement-panel-v42.js`:
  HTTP `200`;
- `https://ec.maxlien.shop/n/`: HTTP `200`;
- SHA-256 público do asset V42:
  `b66779883354958f71e61785009856daac26a64ac95a3bef82116280d68752f8`;
- hashes de `qr.html`, asset V42 e serviço de resposta iguais entre local e VPS;
- navegador oficial: título correto, asset V42 presente uma vez, sem erro de
  console e nenhuma `.chat-preview .meta` na tela disponível.

A sessão isolada usada na validação do navegador não tinha login administrativo.
Por segurança, nenhuma senha ou token foi inserido. A lista privada do cliente foi
validada pela leitura oficial do banco e pelo teste executado sobre o mesmo asset
publicado, sem envio de mensagem real.

## Efeitos externos e preservação

Nenhuma mensagem real, mídia, pedido, Dropi, Meta/CAPI, migração ou escrita de
auditoria no contato foi executada durante desenvolvimento, testes, staging ou
validação.

Permaneceram preservados: produtos, preços, origem das VSLs, checkout, funis,
áudios, pós-venda, Z-API, número oficial, scheduler e os demais processos PM2.
Nenhum projeto externo de aquecimento foi aberto, alterado ou publicado.
