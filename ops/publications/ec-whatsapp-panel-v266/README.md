# Painel WhatsApp EC — correção V266

## Origem e escopo

- Página pública: `https://ec.maxlien.shop/qr.html`.
- Arquivo efetivamente servido pelo Nginx: `/var/www/vitalismen-panel-phonefix-20261108-r1/qr.html`.
- O painel servido continha funções do chat do site V222/V235/V236 ausentes no `public/qr.html` do release do bot. Por isso a correção altera apenas o arquivo estático servido, sem trocar o runtime nem as rotas de entrada e saída.
- SHA-256 do arquivo antes: `ee2b8473767300ee0e95b30d882676040fdb0f82288d5dfbc4401c840015765a`.
- SHA-256 do candidato: `3664ef4267b5c2330b46d39a77a60e4d3828e8fd92646924a8597dbb589c8755`.
- Snapshot integral do painel aprovado: `qr.html.gz` (SHA-256 do arquivo comprimido `8bdae9608a725489ea873a4a8916930478d46fd391735b9ff3e8be5651706d55`). A descompressão deve produzir o SHA-256 do candidato.
- Congelamento e recibos: `docs/freeze/ec-whatsapp-panel-v266-static-20261124.json`.

## Alteração

Aplicar `qr.html.patch` somente sobre o arquivo com o hash anterior. A página passa a ler `/api/whatsapp/status`, mostrar a sessão vinculada no cabeçalho e em Conexões, remover os textos visíveis da integração antiga e tratar erros de API como texto legível. O selo histórico de entrada passa a ser exibido como `ENTRADA REGISTRADA` sem alterar seu valor armazenado. A consulta obsoleta `/api/zapi/status` e `/api/zapi/device` foi removida deste painel.

## Verificação e reversão

- `git apply --check` e aplicação sobre cópia da origem passaram. O arquivo reconstruído teve o mesmo hash do candidato após normalizar LF no Windows.
- Os cinco scripts embutidos passaram em `node --check`.
- Testes isolados cobriram sessão conectada, desconectada e erro de leitura; em todos houve somente chamada a `/api/whatsapp/status`.
- Conferir a página oficial autenticada após a publicação. O backup do arquivo servido deve permanecer no mesmo diretório para reversão pontual.
- Não usar este patch em outro `qr.html` sem conferir o hash de origem.
- Backup privado do estado aprovado: `/root/codex_deploy_backups/ec-whatsapp-panel-v266-20261124.html` no VPS oficial. Backup anterior: `/var/www/vitalismen-panel-phonefix-20261108-r1/qr.html.before-v266-20261124`.
- O arquivo HTML servido pelo Nginx é independente de `public/qr.html` no release do bot. Em novas publicações, conferir o alias real, o hash do arquivo servido e a presença do chat do site antes de substituir o painel.
