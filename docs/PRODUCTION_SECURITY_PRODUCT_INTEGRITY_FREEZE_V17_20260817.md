# Freeze V17 — seguranca publica e integridade de produto EC

Data: 2026-08-17

Status: aprovado para producao pelo pedido do operador “atualize, confirme tudo sem destruir bot”.

## Baseline e rollback

- GitHub oficial: `GitViltaliesmen/vitalismen-maxlien-painel`.
- Branch oficial: `production`.
- Baseline anterior: `e0e2c548be9aeecf076fc5b5ec2a1405f0e0e0e0`.
- Tag anterior: `production-20260816-e0e2c54`.
- Release anterior preservada: `/opt/vitalismen-automacao/releases/20260817T022344Z_production-20260816-e0e2c54`.
- Rollback: repontar `current` para a release acima e recriar somente `vitalismen-automation` se o PM2 nao acompanhar o symlink.

## Microcamadas autorizadas

1. Exigir o login existente do painel para:
   - `GET /api/whatsapp/status`;
   - `GET /api/zapi/config`;
   - `GET /api/zapi/status`;
   - `GET /api/zapi/device`;
   - todas as rotas `/api/observation`.
2. Fazer as leituras auxiliares de `public/qr.html` enviarem o mesmo Bearer ja usado pelo painel.
3. Preservar publicos, sem mudanca de contrato:
   - entrada e rotacao da VSL;
   - `GET /api/zapi/whatsapp-link` usado pela VSL;
   - webhooks Z-API de entrada e entrega;
   - `GET /api/health` somente leitura.
4. Produto EC ausente ou desconhecido passa a ter chave vazia e nunca escolhe Nitrix, Tex Ultra ou Vit Power silenciosamente.
5. Pedido/lead EC novo sem produto explicito e recusado antes de gravacao operacional.
6. Purchase Meta EC sem produto explicito e bloqueado antes de montar ou enviar evento.
7. Alvo Dropi desconhecido fica sem URL/nome/aliases; a autorizacao manual e o catalogo oficial continuam obrigatorios.
8. `.env.example` passa a representar o modo de observacao seguro, com autenticacao ligada e todas as automacoes acopladas desligadas.
9. Dependencias recebem atualizacoes compativeis dentro da linha atual, incluindo Baileys 6.7.24, Axios 1.19.0, Express 4.22.2, Mongoose 8.24.3, protobufjs 7.6.5, Sharp 0.35.3 e ws 8.21.3.

O `npm audit` caiu de 14 ocorrencias (2 criticas) para 3 indiretas no `protobufjs@6.8.8` fixado pelo `libsignal` legado do Baileys 6. O transporte oficial e Z-API e o Baileys esta apenas em coexistencia; forcar protobuf 7 dentro desse libsignal ou migrar para Baileys 7 RC ficou proibido nesta microcamada por risco de quebrar a sessao. Essa pendencia exige piloto separado.

## Preservacoes obrigatorias

- Nenhum preco foi alterado.
- `/n/` continua Tex Ultra e usa 1/2/3/6 frascos por USD 35.99/70.00/80.99/147.99.
- O numero publico atual continua final `8416`.
- Nenhuma mensagem, audio, imagem, guia, pedido ou evento externo e enviado pelos testes/guards desta camada.
- O funil, cadencia, memoria de cliente, schema, scheduler, locks e deduplicacao anti-spam nao foram reordenados.
- Dropi continua exigindo produto/preco oficial e autorizacao humana antes do envio.

## Validacao obrigatoria

```sh
npm run senior:check
node --test tests/*.test.mjs tests/*.test.cjs
npm run guard:ec-product-micro-layer
npm run guard:ec-dropi-catalog
npm run guard:guide-print-spam
npm run guard:pickup-notifications
npm run guard:freeze-lock
```

Depois da ativacao:

```sh
pm2 jlist
readlink -f /opt/vitalismen-automacao/current
curl -fsS https://ec.maxlien.shop/api/health/
```

As rotas sensiveis devem retornar `401` sem Bearer; `/api/zapi/whatsapp-link`, webhooks, VSL e health devem continuar publicamente acessiveis conforme seus contratos.
