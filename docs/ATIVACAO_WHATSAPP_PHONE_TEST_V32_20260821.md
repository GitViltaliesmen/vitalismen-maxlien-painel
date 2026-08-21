# Ativação V32 — telefone oficial e canário de mídia

Data: 2026-08-21

## Escopo ativado

- Telefone oficial único: `5515991418416`.
- Telefone QA único: `5515998038637`.
- Transporte oficial preservado: Z-API.
- PR: `#22`.
- Commit de produção: `4dbb541c4af74844e44ef14c50cb10b14dab7400`.
- Tag: `production-20260821-4dbb541`.

## Release e rollback

- Release ativa: `/opt/vitalismen-automacao/releases/20260821T222100Z_production-20260821-4dbb541`.
- Backup pré-ativação: `/opt/vitalismen-automacao/backups/pre-v32-20260821T222100Z`.
- Release de rollback: `/opt/vitalismen-automacao/releases/20260821T193942Z_production-20260821-03cee3a`.
- O backup contém o `.env` ativo anterior, o `.env` candidato antes do ajuste e metadados de origem, todos restritos a `root`.

## Validação executada

- Suíte local e no candidato VPS: `245/245` testes aprovados.
- Lint e guards de produto, freeze, anti-spam e telefone V32 aprovados.
- GitHub Actions Node 20 e Node 22 aprovados.
- Cloudflare Pages aprovado.
- PM2 `vitalismen-automation` online, zero reinícios instáveis e caminhos resolvidos para a release ativa.
- `https://ec.maxlien.shop/api/health/` e `https://ec.maxlien.shop/n/` responderam HTTP 200.
- Z-API conectada, smartphone conectado e device confirmado como `5515991418416`.
- Permit de ativação consumido; rollback automático não foi necessário.

## Canário de mídia

- Um áudio OGG/Opus oficial de uso do Tex Ultra foi enviado somente para `5515998038637` e confirmado como entregue (`ack=2`).
- Uma imagem PNG oficial do Tex Ultra foi enviada somente para `5515998038637` e confirmada como entregue (`ack=2`).
- O telefone QA respondeu ao número oficial com um áudio e três imagens novos.
- O áudio inbound foi persistido como MP3 e as três imagens como JPEG; os quatro arquivos terminaram em `READY`, sem erro de download, no storage compartilhado `/opt/vitalismen-automacao/shared/media/inbound`.
- O endpoint público sem autenticação respondeu HTTP 401.
- O painel autenticado serviu o áudio e uma das imagens com HTTP 206, suporte a `Range`, MIME correto e conteúdo físico compatível com o tamanho persistido.
- Nenhum disparo em massa foi executado.
- O canário real de envio e recebimento de áudio/imagem foi concluído.

## Preservado

Clientes, pedidos, Dropi, Meta/CAPI, pixel, preços, checkout, produtos, funil e mídia histórica não foram alterados. Documentos históricos mantêm evidências datadas e não são usados como configuração ativa.
