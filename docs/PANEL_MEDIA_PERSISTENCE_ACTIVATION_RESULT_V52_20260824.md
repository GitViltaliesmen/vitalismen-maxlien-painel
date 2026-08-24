# Resultado da ativação V52 — persistência do áudio e mídia manual

## Produção oficial

- Domínio: `https://ec.maxlien.shop/`
- Tag: `production-20260824-1bf5013`
- Commit: `1bf501351be7279d19512f4bb688d800cd143da1`
- Release ativa:
  `/opt/vitalismen-automacao/releases/20260824T020500Z_production-20260824-1bf5013`
- Rollback preservado:
  `/opt/vitalismen-automacao/releases/20260824T001100Z_production-20260824-bab7bbb`
- Ativação transacional concluída em `2026-08-24`, sem rollback.

## Validações

- `npm test`: `317/317` testes oficiais aprovados.
- Guard V52: `25/25` testes direcionados aprovados.
- `npm run lint`: `410` arquivos JavaScript válidos.
- `senior:check`: aprovado.
- `audit-ec-product-micro-layer.mjs`: aprovado.
- Checks remotos Node 20, Node 22 e Cloudflare Pages: aprovados.
- `public/qr.html`: HTTP 200 e SHA-256
  `aa93c7006fcbbd648e54667034e5a233e8f2c2a44b74e48fb46fbe2c294a664b`.
- `/n/`: HTTP 200.
- Os dois arquivos de agradecimento: HTTP 200, `audio/ogg`, 89.011 bytes.
- Catálogo ativo: 51 áudios; somente `Chegou_01`, `Chegou_02` e `Chegou_03`
  são classificados como etapa de retirada.
- `Agradecimento_Agencia_01` e `AGRADECIMENTO_AGENCIA_DE_ENTREGA` estão ativos
  e classificados como comerciais, não como retirada antecipada.
- Health: `online`, sem degradação, WhatsApp pronto, Z-API conectada e saída
  não bloqueada.
- PM2 `vitalismen-automation`: PID `2434970`, `online`, zero reinícios
  instáveis, `pm_cwd=/opt/vitalismen-automacao/current` e
  `pm_exec_path=/opt/vitalismen-automacao/current/src/index.js`.

Nenhuma mensagem ou mídia foi enviada a cliente durante os testes ou a
validação da ativação. Nenhum pedido, Dropi ou Meta/CAPI foi criado ou alterado.
