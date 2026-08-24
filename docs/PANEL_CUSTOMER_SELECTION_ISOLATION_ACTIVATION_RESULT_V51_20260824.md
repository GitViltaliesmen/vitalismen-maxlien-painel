# Resultado da ativação V51 — isolamento da ficha selecionada

## Produção oficial

- Domínio: `https://ec.maxlien.shop/`
- Tag: `production-20260824-bab7bbb`
- Commit: `bab7bbbb8fab1d9a539a1df12097d7ba2953a735`
- Release ativa:
  `/opt/vitalismen-automacao/releases/20260824T001100Z_production-20260824-bab7bbb`
- Rollback preservado:
  `/opt/vitalismen-automacao/releases/20260823T235000Z_production-20260823-a17e519`
- Ativação transacional concluída em `2026-08-24`, sem rollback.

## Validações

- `npm test`: `316/316` testes oficiais aprovados.
- V49–V51: `16/16` aprovados.
- Navegador Playwright: troca sintética `2490 -> 1150`, resposta atrasada de
  Mira descartada e apenas um autosave para agência idêntica.
- `senior:check`: aprovado.
- `audit-ec-product-micro-layer.mjs`: aprovado.
- Checks remotos Node 20, Node 22 e Cloudflare Pages: aprovados.
- `public/qr.html`: HTTP 200 e SHA-256
  `bc674e373f0a800ccbb6db98130cffc6138a0094bcfcf70f6f63f01a97abeccf`.
- Helper V51: HTTP 200 e SHA-256
  `378da40b813e751b933b308d5d791ac83b406c49bc7483e08adb7f181e6d759a`.
- `/n/`: HTTP 200.
- Health: `online`, sem degradação, WhatsApp pronto, Z-API conectada e saída
  não bloqueada.
- PM2 `vitalismen-automation`: PID `2417955`, `online`, zero reinícios
  instáveis, `pm_cwd=/opt/vitalismen-automacao/current` e
  `pm_exec_path=/opt/vitalismen-automacao/current/src/index.js`.

## Cliente auditado

A leitura somente leitura após a ativação confirmou que a ficha final `1150`
permanece em `Guayaquil / Guayas / Guayaquil Los Almendros`. Um pedido manual,
criado pela operação antes da ativação V51, está `confirmed`, com 3 frascos por
USD 80.99, localização correta e sem `dropiOrderId`. A V51 não criou nem alterou
esse pedido. Não houve novo `PATCH` dessa ficha após a ativação durante a janela
de validação.

Nenhuma mensagem, mídia, pedido, Dropi, Meta/CAPI ou escrita em cliente real foi
executada pelos testes ou pelo processo de ativação.
