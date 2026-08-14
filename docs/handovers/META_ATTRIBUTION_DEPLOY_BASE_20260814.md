# Base da implantação controlada de atribuição Meta

## Estado registrado antes do transplante

- Data UTC do backup: `20260814T211511Z`.
- Release ativa: `/opt/vitalismen-automacao/releases/202608140449`.
- Link `current`: `/opt/vitalismen-automacao/current` → release acima.
- Webroot servido: `/var/www/ec.maxlien.shop`.
- Processo: `vitalismen-automation`, online, executando por `current`.
- Commit local de referência da correção: `15560ad17022b9e831d52a468b721f0b2ab8d31d`.
- Commit sincronizado anterior à correção: `1d63a25582db21a787c8821c861702f01715002a`.

## Backup verificado

Diretório:

`/opt/vitalismen-automacao/backups/meta-attribution-purchase-20260814T211511Z`

Conteúdo:

- cópia completa da release ativa;
- cópia completa do webroot EC;
- cópia separada dos arquivos candidatos;
- metadados do estado anterior;
- checksums SHA-256 dos arquivos candidatos, todos validados com sucesso.

## Base local deste branch

Os arquivos abaixo foram importados mecanicamente da produção ativa antes de qualquer edição, para preservar correções posteriores ao commit sincronizado:

- `public/n/index.html`, a partir do webroot realmente servido;
- `src/models/VslVisit.js`;
- `src/routes/whatsapp.js`;
- `src/routes/zapi.js`;
- `src/services/ecuadorProductService.js`;
- `src/services/metaAttributionService.js`;
- `src/services/metaAttributionBridgeService.js`;
- `tests/meta-attribution-bridge.test.mjs`.

A ponte preexistente por mensagem exata, o isolamento do Equador e a seleção de produto do painel devem permanecer preservados. O transplante `TX-...` será adicional e limitado à continuidade de atribuição.

## Rollback planejado

Caso o candidato seja publicado e o smoke test falhe:

1. reapontar `/opt/vitalismen-automacao/current` para `/opt/vitalismen-automacao/releases/202608140449`;
2. restaurar `/var/www/ec.maxlien.shop/n/index.html` a partir de `selected-webroot/n/index.html` do backup;
3. reiniciar somente `vitalismen-automation`;
4. validar `/api/health`, o status do PM2 e o hash da landing restaurada.

Os comandos exatos, o nome da nova release e os hashes serão registrados no relatório pós-deploy. Nenhum banco, anúncio, Dropi ou ambiente da Colômbia faz parte deste rollback.
