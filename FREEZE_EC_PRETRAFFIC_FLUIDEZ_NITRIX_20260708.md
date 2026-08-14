# FREEZE EC PRE-TRAFEGO FLUIDEZ NITRIX - 2026-07-08

## Objetivo

Congelar a camada aprovada da pagina publica EC/Nitrix e do painel operacional EC antes de trafego.
Este registro existe para preservar o estado validado da pagina, do CTA, do WhatsApp oficial e do processo de navegacao fluida no atendimento.

## Escopo Congelado

- Dominio publico oficial: `https://ec.maxlien.shop`.
- Rota de trafego oficial: `https://ec.maxlien.shop/n/`.
- CTA visual de teste: `https://ec.maxlien.shop/n/?showForm=1&test=cta-visual`.
- Painel operacional: `https://ec.maxlien.shop/qr.html`.
- WhatsApp oficial EC: `553183002800`.
- Identidade Z-API validada: `Valeria Zambrano`.
- Produto oficial da rota `/n/`: `Nitrix Oxide Ecuador`.
- Pixel EC ativo: `1468946114265008`.
- Moeda EC: `USD`.
- Fluxo de venda: Purchase somente depois de pedido confirmado com valor positivo.

## Fluidez Operacional Aprovada

- Lista de clientes carregada em modo leve.
- Selecao de cliente renderiza imediatamente cabecalho, telefone, status e dados basicos.
- Mensagens carregam sob demanda com `fast=1` e limite inicial controlado.
- Troca rapida de cliente usa chaves de requisicao para descartar resposta antiga.
- Cargas pesadas do painel ficam adiadas por pequenos timers.
- A tela evita rerender quando a assinatura dos dados nao mudou.
- Historico antigo deve permanecer sob demanda, com limite ou paginacao.
- Atendimento humano preserva ficha, historico e guardas antes de qualquer acao operacional.

## Regras De Nao Regressao

- Nao alterar telefone oficial `553183002800`.
- Nao inserir telefone, porta, dominio ou rota que nao pertenca ao EC oficial.
- Nao alterar Pixel, token, banco, Dropi, moeda ou pais nesta camada.
- Nao mudar conteudo automatico do bot nesta camada.
- Nao enviar Purchase sem pedido confirmado.
- Nao remover guardas de freeze, spam, produto, Valeria e Nitrix.
- Nao deixar release ativo apontando para commit diferente do Git publicado.

## Evidencias Da Validacao

- Git local limpo e sincronizado com GitHub e Git do VPS.
- Release ativo no VPS antes do congelamento: `/opt/vitalismen-automacao/releases/20260708203913`.
- Commit base validado antes deste registro: `bbdbef4`.
- PM2 `vitalismen-automation`: online, apontando para release oficial, sem restarts.
- `https://ec.maxlien.shop/n/`: HTTP 200, Nitrix, telefone final 2800.
- `https://ec.maxlien.shop/n/?showForm=1&test=cta-visual`: HTTP 200, CTA com telefone final 2800.
- `https://ec.maxlien.shop/api/zapi/status`: conectado, telefone `553183002800`, nome `Valeria Zambrano`.
- `https://ec.maxlien.shop/api/zapi/whatsapp-link`: retorna link para `wa.me/553183002800`.

## Testes Obrigatorios Para Manter A Camada

- `node scripts/audit-ec-nitrix-guard.mjs`
- `node scripts/audit-ec-valeria-identity.mjs`
- `node scripts/audit-ec-product-micro-layer.mjs`
- `node scripts/audit-guide-print-spam-guard.mjs`
- `node scripts/audit-no-regression-meta-country.mjs`
- `node scripts/guard-freeze-lock-ec.mjs`
- `node scripts/guard-public-funnel.mjs`
- `node scripts/official-state-audit.mjs`

## Resultado

Camada aprovada para pre-trafego EC/Nitrix. A pagina publica, CTA, painel, Z-API, guardas e processo operacional ficam congelados neste estado ate nova autorizacao escrita.
