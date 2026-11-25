# V271 — confirmação explícita de recompra no painel EC

## Diagnóstico em produção

Em 25/11/2026, a ficha do pedido `EC-RECOMPRA-MWVKPZ5K-4HPR` tinha produto Vit Power, 3 frascos, USD 95,99 e dados de entrega validados. O pedido Mongo continuava `draft`, com quantidade e valor zerados. A ficha permanecia em `recompra`; o painel mostrava "Pedido já está em fluxo" e o botão genérico "Salvar dados". A fila Dropi exige pedido confirmado. Uma varredura somente leitura encontrou dois rascunhos de recompra vinculados a fichas; apenas um tinha oferta completa. Nenhum pedido foi enviado ou confirmado durante a auditoria.

## Mudança candidata

No painel compartilhado pelos três produtos EC, uma nova recompra com oferta e dados completos apresenta "Confirmar recompra". O clique exige confirmação humana, usa a persistência confirmada existente e só declara sucesso depois da prova de leitura e visibilidade em Confirmados. Enquanto faltarem dados, a ficha pode continuar sendo salva como rascunho. O envio à Dropi permanece manual. VSL, funis, transporte WhatsApp, preços, Dropi, Meta e pedidos históricos não foram modificados.

## Testes

- Simulação isolada no navegador para Vit Power, Tex Ultra e Nitrix: uma oferta completa não confirma sem clique; o clique envia `confirmado` à rota autenticada simulada.
- Simulação de resposta sem prova de persistência: o painel volta a `recompra` e não declara sucesso.
- `tests/panel-confirmed-persistence-v158.test.mjs`: dez casos aprovados.
- `tests/panel-customer-status-busy-v178.browser.test.mjs`: aprovado.
- `npm run lint`: aprovado.
- `npm run guard:panel-confirmed-v158`: bloqueado pelo hash histórico de `public/qr.html`; o commit de produção V270 já diverge do hash V158, que requer sucessor selado. Não alterar o guard histórico.
- `tests/v146-definitive-normalization.test.mjs` no Windows: não executa porque importa módulo selado instalado apenas no VPS.

## Publicação e congelamento — 25/11/2026

- Commit funcional `7020adb3ef12f568ca37cb4d2c2a2186a74c530c`, tag `ec-repurchase-confirm-v271-20261125` e release materializada `/opt/vitalismen-automacao/releases/20261125T040212Z_production-20261125-7020adb`.
- A autoridade sucessora V271 validou commit, árvore, hashes e perfil; `npm run senior:check` passou no VPS sobre a release materializada. O backup está em `/opt/vitalismen-automacao/backups/ec-repurchase-confirm-v271-20261125T040212Z`.
- O Nginx servia `/qr.html` de `/var/www/vitalismen-panel-phonefix-20261108-r1/qr.html`, independente de `public/qr.html` da release. A cópia pública anterior tinha SHA-256 `3664ef4267b5c2330b46d39a77a60e4d3828e8fd92646924a8597dbb589c8755` e continha recursos mais recentes que o HTML da release. Ela foi preservada e recebeu somente a microalteração de confirmação de recompra em uma nova cópia versionada `/var/www/vitalismen-panel-repurchase-v271-r1/qr.html`, SHA-256 `e352c65e636ff53661deb29ecfa6c609c6607b9241954684a6da38fe401608de`.
- O alias exato de `/qr.html` em `/etc/nginx/sites-enabled/ec.maxlien.shop.clean.conf` aponta à nova cópia. O arquivo Nginx e o HTML anteriores foram copiados ao backup acima. `nginx -t` passou antes do reload.
- A simulação Playwright do HTML efetivamente publicado passou para Vit Power, Tex Ultra e Nitrix; o cenário de prova de persistência ausente também passou. O conteúdo obtido por HTTPS da URL pública respondeu HTTP 200 e teve o mesmo SHA-256 da nova cópia.
- PM2 `vitalismen-automation` permaneceu online com script e diretório em `/opt/vitalismen-automacao/current`, health HTTP 200; o timer de pós-venda V203 permaneceu ativo. Nenhuma recompra real foi confirmada ou enviada à Dropi por esta publicação.

Para rollback do painel, restaurar o arquivo Nginx `ec.maxlien.shop.clean.conf.before-v271` do backup, validar `nginx -t` e recarregar Nginx. A cópia pública anterior permanece intacta. O rollback do runtime segue a autoridade selada anterior; não editar uma release ativa.
