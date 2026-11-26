# EC V272 — QR da sessão vinculada na aba Conexões

## Escopo

A sessão WhatsApp Business estava em `scanning` e a API retornava `qrCode`, mas a aba Conexões do painel mostrava somente a frase de espera. A V272 desenha o QR existente nessa aba quando a sessão ainda não está conectada. Após conexão ou com um valor de QR inválido, a imagem não é renderizada.

A alteração é visual no `public/qr.html` e na cópia estática servida por Nginx. Não altera VSL, número, transporte, funis, inbound, saída, pedidos, Dropi, Meta ou o runtime V271.

## Publicação e backup

- Origem estática anterior: `/var/www/vitalismen-panel-repurchase-v271-r1/qr.html`, SHA-256 `e352c65e636ff53661deb29ecfa6c609c6607b9241954684a6da38fe401608de`.
- Backup: `/opt/vitalismen-automacao/backups/ec-connection-qr-v272-20261126T0125Z/`, contendo a página anterior e a configuração Nginx anterior.
- Página atual: `/var/www/vitalismen-panel-qr-v272-r1/qr.html`, SHA-256 `1cd09d09a87283a161bd14deb592db1dfe542679a1c40f0a88583df72c0cc6e3`.
- A rota exata `/qr.html` do Nginx aponta somente para a nova página. `nginx -t` passou e o serviço foi recarregado.
- A URL pública `https://ec.maxlien.shop/qr.html?v=20261112-v206` respondeu 200 e retornou o mesmo SHA-256.
- O PM2 permaneceu online em `/opt/vitalismen-automacao/releases/20261125T040212Z_production-20261125-7020adb`; health respondeu 200. A API de sessões respondeu `scanning`, não conectado, com QR não vazio.

## Verificação e limite

`tests/panel-connection-qr-v272.browser.test.mjs` passou contra o arquivo do repositório e a página publicada: mostra QR em `scanning`, oculta em `connected` e rejeita URL inválida. `node scripts/lint-js-syntax.mjs` passou.

O `npm run senior:check` local não concluiu porque o módulo selado `/usr/local/lib/vitalismen-deploy/gira21x-sealed-successor-v1.mjs` não existe no Windows. O mesmo comando no release V271 do VPS falhou em um guard de herança já presente, com `.github/workflows/ec-panel-quality.yml` divergente. A V272 não modifica esse arquivo nem o release V271. Por esse motivo, esta publicação é limitada à página estática e não declara o runtime validado por esse guard.

A leitura do QR no celular e a confirmação da conexão ainda dependem da ação do operador. Esta publicação não comprova inbound ou resposta automática.

## Rollback

Restaurar a configuração Nginx salva no backup e recarregar Nginx após `nginx -t`. O runtime V271 não precisa ser trocado para esse rollback visual.
