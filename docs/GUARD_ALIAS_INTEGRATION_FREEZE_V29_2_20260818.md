# Freeze técnico V29.2 — integração dos aliases de guard

Data: 2026-08-18 (UTC)

Estado: preparação cumulativa de release autorizada; ativação não autorizada.

## Causa

A linhagem V28 → V29 → V29.1 estava íntegra e o `senior:check` aprovava a regressão completa, mas seis aliases operacionais em `package.json` ainda chamavam diretamente o guard imutável V28. Como `package.json`, `src/index.js` e `src/routes/shipments.js` foram substituídos por sucessores autorizados, esses aliases falhavam por hash antigo antes de executar sua validação funcional.

Os aliases afetados eram:

- `guard:whatsapp-chats-readonly`;
- `guard:operational-mode-zapi-health`;
- `guard:ec-nitrix`;
- `guard:ec-identity`;
- `guard:tex-ultra-approved`;
- `guard:ec-product-funnel-isolation`.

Os aliases de compatibilidade V29 e V29.1 também precisavam entrar pelo sucessor atual para não reabrir diretamente um runtime pai já substituído.

## Correção autorizada

Em 2026-08-18T18:50:59Z, o operador autorizou a atualização identificada pela varredura. A autorização cobre somente esta microcamada local de integração dos guards.

- `src/index.js` passa a carregar o runtime V29.2.
- Os aliases entram pelo runtime sucessor V29.2 e preservam seus testes/auditorias específicos.
- `senior:check` inclui o guard e o teste V29.2.
- `deploy:ec-safe` e `deploy:vps` continuam fail-closed antes de qualquer acesso remoto, com saída 78 e exigência de autorização operacional separada.

## Preservado

Nenhum arquivo de funil, produto, preço, oferta, áudio, mídia, VSL, painel, pedido, Dropi, Meta/CAPI, scheduler, transporte, banco ou logística foi alterado por esta microcamada. A V29 funcional e a V29.1 de integração permanecem herdadas por hash.

A produção continua na release que já estava ativa antes desta microcamada:

```text
/opt/vitalismen-automacao/releases/20260818T042423Z_production-20260818-bb2d92f
```

## Autorização do release train

Em 2026-08-18T21:24:36Z, o operador autorizou por escrito o release train cumulativo `bb2d92f → V29.2` para resolver, em uma única sequência, os bloqueios de auditoria, commit, push, PR em rascunho, CI, acesso SSH, backup, rollback, promoção Git sem force push, tag oficial, release imutável e staging completo.

A autorização termina obrigatoriamente em `READY_FOR_ACTIVATION = TRUE/FALSE`. Ela não permite alterar `current`, reiniciar PM2, gerar/consumir permit root de ativação, enviar mensagem real, criar pedido real, acionar Dropi ou Meta/CAPI, nem ativar produção. A ativação continua dependendo de nova autorização explícita depois da apresentação do relatório final.

## Publicação e rollback

O commit e a promoção Git desta candidata são cumulativos e não podem ser tratados como microdeploy isolado. O rollback operacional permanece a release efetivamente ativa imediatamente antes de qualquer ativação, atualmente `20260818T042423Z_production-20260818-bb2d92f`.

Enquanto não ativado, `current`, PM2, PID e o tráfego público devem permanecer na release operacional acima.
