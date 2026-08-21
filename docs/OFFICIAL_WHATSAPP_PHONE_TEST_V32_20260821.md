# V32 — telefone WhatsApp oficial e teste controlado

Data da autorização: `2026-08-21T22:05:22Z`.

Escopo exclusivo: Vitalismen / Maxlien Ecuador oficial.

## Decisão operacional

- número oficial único de recebimento e saída: `5515991418416`;
- telefone brasileiro único de teste: `5515998038637`;
- Z-API permanece como transporte oficial;
- outros números brasileiros não podem aparecer em configuração, pool,
  override público, slot do painel ou allowlist ativa;
- registros históricos congelados continuam somente como evidência e nunca
  são fonte de configuração operacional.

## Ajustes autorizados

- remover overrides públicos e defaults de scripts que apontavam para números
  desativados;
- manter um único slot operacional no painel para `5515991418416`;
- exibir e autorizar `5515998038637` como contato brasileiro de QA;
- restringir as listas de teste do VPS exclusivamente a `5515998038637`;
- manter `WHATSAPP_AUTO_REPLY_ALLOWED_RECIPIENTS` vazio para não bloquear
  clientes EC reais no modo operacional completo;
- permitir um canário individual de áudio e imagem nos dois sentidos com o
  telefone de teste.

## Segurança do teste

O telefone `5515998038637` é protegido por rotas que impedem pedido e Dropi e
fica fora de Meta/CAPI quando a entrada é marcada como teste. A autorização não
permite disparo em massa, varredura retroativa, remoção de conversa ou alteração
de clientes reais.

Mídia enviada pelo sistema deve ser somente asset aprovado do Tex Ultra. Mídia
recebida precisa atravessar a Z-API, ser persistida no storage compartilhado,
chegar a `READY` e ser aberta pelo painel autenticado. A prova inbound depende
de o operador responder pelo telefone de teste com um áudio e uma imagem novos.

## Preservado

Produtos, preços, ofertas, VSL, checkout, pedido, Dropi, Meta/CAPI, pixel,
scheduler, pós-venda V31, deduplicação, número de clientes e storage V30 não são
alterados. Nenhum banco de cliente é limpo.

## Rollback

Retornar à release
`/opt/vitalismen-automacao/releases/20260821T193942Z_production-20260821-03cee3a`,
restaurar o backup do `.env` da V32 e reiniciar somente
`vitalismen-automation`. Preservar o storage compartilhado inbound.
