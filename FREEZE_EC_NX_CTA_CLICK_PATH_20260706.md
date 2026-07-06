# Freeze EC NX CTA Click Path 2026-07-06

## Problema
- O Facebook/Instagram estava entregando trafego para `https://ec.maxlien.shop/n/`.
- Logs de servidor mostraram visitas pagas com `fbclid` e `utm_source=fb/ig`.
- A colecao `VslVisit` mostrou entradas na VSL, mas `clickCount=0` desde o inicio da camada Nitrix.
- Portanto, as ~170 entradas vistas eram visitas/entradas de VSL, nao clientes no painel.

## Causa Provavel
- O backend de clique funcionava quando o botao local era acionado.
- O gargalo estava no caminho final da CTA:
  - CTA/formulario exigia nome e telefone antes de abrir WhatsApp.
  - Android usava `intent://`, mais fragil em navegador interno.
  - `/n/` estava publicado em `/var/www/ec.maxlien.shop/n/index.html`, mas nao estava versionado no Git.
  - Nao havia metrica separada para saber se o cliente viu a CTA/formulario no minuto final.

## Correcao
- `public/n/index.html` entrou no Git como fonte versionada da rota Nitrix EC.
- CTA final agora mostra `Finalizar por WhatsApp`.
- Nome e telefone ficaram opcionais; se preenchidos, vao na mensagem.
- Android e iOS usam `https://wa.me/...` em vez de `intent://`.
- Botao nao usa mais transform/scale continuo, evitando instabilidade de toque.
- Fallback absoluto respeita o minuto aprovado da VSL: `2280s` = 38 minutos.
- A pagina grava `cta_visible` via `/api/whatsapp/vsl-entry`.
- `VslVisit` agora guarda:
  - `formVisibleCount`
  - `lastFormVisibleAt`
  - `lastFormVisibleReason`
- A rota preserva campos de CTA/clique contra requisicoes paralelas.

## Validacao
- Auditoria local e VPS:
  - `scripts/audit-ec-nx-funnel-click-path.mjs`
  - resultado: `OK - CTA final Nitrix medido e sem bloqueio de formulario.`
- Teste Playwright mobile:
  - URL: `/n/?showForm=1&testLead=1&utm_source=codex&utm_medium=qa`
  - nome obrigatorio: `false`
  - telefone obrigatorio: `false`
  - clique abriu `https://api.whatsapp.com/send/?phone=553183002800...`
- Banco:
  - `clickCount=1`
  - `formVisibleCount=1`
  - `lastFormVisibleReason=forced_show_form`
  - `metaInitiateCheckoutSentAt` gravado
  - `metaLeadSentAt` gravado
  - Meta CAPI respondeu `events_received=1` para `InitiateCheckout` e `Lead`

## Estado Final
- `https://ec.maxlien.shop/n/` publicado.
- Hash igual entre app e webroot:
  - `/opt/vitalismen-automacao/current/public/n/index.html`
  - `/var/www/ec.maxlien.shop/n/index.html`
- Health EC online.
- Z-API EC conectado no final `2800`.

## Backups VPS
- `/root/codex_deploy_backups/ec-nx-click-path-20260706T1308*/`
- `/root/codex_deploy_backups/ec-nx-click-path-route-race-20260706T131110Z/`

## Regra Operacional
- Com VSL de 40 minutos, campanha nao deve ser julgada por Purchase imediato.
- Agora acompanhar:
  - entradas VSL;
  - `cta_visible`;
  - `whatsapp_click`;
  - respostas reais no WhatsApp;
  - compras confirmadas no painel.
- Se `cta_visible` crescer e `whatsapp_click` continuar baixo, o problema e oferta/CTA.
- Se `whatsapp_click` crescer e o painel nao receber inbound, revisar abertura/envio no WhatsApp.
