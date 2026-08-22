# Microcamada V43 — prioridade do painel e confirmação local do AQUECIMENTO EC

Data: 2026-08-22.

## Decisão autorizada

Este freeze sucede a V42 e altera somente a prioridade visual dos filtros do
painel e a confirmação local de contatos aprovados manualmente por `#aquece`.
O operador solicitou `Tudo` como tela principal, a separação das não lidas do
`AQUECIMENTO` e um `👍` depois de cada lote de duas ou três entradas voluntárias,
sem consumir crédito de modelo.

O ambiente continua sendo exclusivamente o Vitalismen Ecuador oficial no VPS
`72.60.137.77`, domínio `ec.maxlien.shop` e diretório
`/opt/vitalismen-automacao/current`. Nenhum projeto externo de aquecimento é
consultado, copiado ou ativado.

## Base congelada antes da alteração

- SHA local e `origin/production`: `56ef80c43f692e91b654a7b6944233600dd365d1`;
- release funcional ativa: `/opt/vitalismen-automacao/releases/20260822T185502Z_production-20260822-cbd6dfc`;
- tag funcional ativa: `production-20260822-cbd6dfc`;
- PID PM2 observado: `2188070`;
- branch isolada: `codex/ec-engagement-priority-v43-20260822`;
- manifesto pai V42 SHA-256: `3dfb04a48226b960f42d59829c347b4ba83a45876039cc8020b4fa761386611d`;
- árvore local limpa antes da primeira edição.

## Prioridade visual do painel

Ao carregar `public/qr.html`, o filtro de mensagens inicial é `Tudo`. `Novas`,
`Lidas`, `Favoritas`, `Grupos` e `Etiquetas` só passam a filtrar após clique do
operador. As filas operacionais permanecem independentes e `ATENDIMENTO`
continua sendo a fila inicial.

O contador e o filtro `Novas` excluem qualquer conversa cujo bucket resolvido
seja `engagement`. Essas não lidas ficam visíveis em um selo vermelho próprio
do botão `AQUECIMENTO`. Ao abrir essa fila, o operador vê todos os contatos dela,
inclusive os não lidos, sem contaminar a prioridade comercial de `Novas`.

A lista esquerda continua sem texto de mensagem.

## Lote local 2 → 3 → 2

Somente um contato que possua simultaneamente bucket `engagement`, seleção
manual, `metadata.warmup.allowed=true` e ausência de bloqueio/risco participa da
contagem. Cada nova entrada do cliente é contada uma única vez pelo identificador
persistido da mensagem.

- o primeiro ciclo aguarda duas entradas;
- após envio confirmado de `👍`, o contador zera;
- o segundo ciclo aguarda três entradas;
- após novo envio confirmado, volta a aguardar duas;
- a alternância continua `2, 3, 2, 3`.

A resposta é o texto fixo local `👍`. Não há prompt, API de modelo, transcrição,
análise de mídia, abertura de link ou consumo de crédito. O contador de chamadas
de modelo permanece zero.

Se uma entrada mais nova chegar durante o debounce, a tentativa anterior é
cancelada e somente a entrada mais recente pode adquirir o lock. Falha de
transporte não zera o lote e não cria retry automático.

## Prioridades e travas preservadas

Antes de qualquer `👍`, intenção comercial, produto, preço, pedido, suporte,
risco e opt-out continuam sendo classificados pelo contrato V40/V42 e retiram a
conversa desse caminho passivo. Permanecem obrigatórios:

- nova entrada voluntária; nenhuma iniciação automática;
- debounce determinístico de 12–25 segundos;
- bloqueio por atividade humana recente;
- cooldown e teto diário;
- lock, histórico e deduplicação persistentes;
- ausência de disparo frio, em massa ou conversa artificial;
- telefone protegido de QA sem tratamento como cliente real.

Reaplicar `#aquece` reinicia o lote em duas sem enviar o comando ao cliente.
Mover para outra fila zera a contagem passiva.

## Preservado

- produtos, preços, ofertas e origens VSL;
- `/n/` Tex Ultra, `/m/` Vit Power e origem Nitrix explícita;
- checkout, pedidos, Dropi, Meta/CAPI e pixel;
- Z-API, número oficial, mídias, áudios e pós-venda;
- scheduler, PM2 e storage;
- busca de clientes V41;
- rótulos e resolução de bucket V42;
- nenhum envio real em teste.

## Testes e rollback

Os testes V43 usam objetos sintéticos, política pura do painel e planejamento
local de resposta. Não enviam WhatsApp, não escrevem Mongo, não criam pedidos,
não chamam Dropi e não emitem Meta/CAPI.

Rollback operacional: reativar a release
`/opt/vitalismen-automacao/releases/20260822T185502Z_production-20260822-cbd6dfc`.
Em emergência, `EC_ENGAGEMENT_AUTO_REPLY_ENABLED=false` desliga as respostas de
relacionamento sem apagar buckets, histórico ou dados comerciais.
