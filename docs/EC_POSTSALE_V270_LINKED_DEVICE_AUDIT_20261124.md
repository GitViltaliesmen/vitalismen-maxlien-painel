# Pós-venda EC no dispositivo vinculado — auditoria V270

Data: 2026-11-24. Escopo: somente Vitalismen Ecuador, bot no release V269.

## Falha observada

- `vitalismen-postsale-full-v203.service` falhou em 2026-11-23T20:19:27Z com `V263_EXECUTOR_FAILED`; o controlador parou o timer V203. O log privado do executor registra `AxiosError: Request failed with status code 400` na consulta antiga à Z-API. Os ciclos anteriores terminaram sem envio, exceto um ciclo com um envio em 2026-11-23T15:05:53Z; esse recibo não comprova entrega ao cliente.
- A autoridade V263 R2 está ligada ao release `20261121T172300Z_production-20261121-d6a815d`, mas `current` e PM2 executam V269 `20261124T162817Z_production-20261124-60bf27e`. `check_source` e o preload V263 exigem igualdade com o release pai. Religá-los sob V269 falharia fechado.
- A V263 autoriza apenas `guide,in_transit,ready_for_pickup`. O bônus após entrega ou retirada comprovada não integra esse perfil. Não inferir entrega a partir de uma guia ou da chegada à agência.
- O PM2 V269 possui a sessão WhatsApp vinculada, mas `DISABLE_SCHEDULER=1`, `SHIPMENT_STATUS_DISPATCH_ENABLED=false` e `PICKUP_PROOF_SWEEP_ENABLED=false`. O processo isolado V263 não compartilha o socket do PM2. `scripts/post-sale-full-v188.mjs` ainda exige `getZapiStatus()` antes de selecionar avisos.
- Uma simulação HTTP `POST /api/shipments/dispatch/run` com `dryRun=true`, `force=true` e limite 1 recebeu HTTP 423, código `EC_BOT_CORE_V78_OPERATION_BLOCKED`, motivo `ec_panel_status_v177_route_blocked`. Não contornar essa barreira com outra rota ou credencial.

## Testes executados

No release V269, 38 testes de `post-sale-full-operational-v188`, `post-sale-dropi-tracking-v194`, `shipment-pickup-notification` e `pickup-bonus-delivery-v60` passaram. Eles exercitam seleção, origem Dropi, deduplicação e prova para bônus em simulação; não comprovam envio pelo dispositivo vinculado nem ativação do timer. A tentativa local no Windows não executou por depender do módulo selado exclusivo do VPS, então o resultado válido é o teste no VPS.

## Contrato para o sucessor

1. Criar autoridade sucessora própria vinculada ao commit, árvore, hashes e release V269. Manter V269 como rollback e preservar VSL, painel, funis, pedidos, Dropi apply e Meta.
2. Manter a seleção e o lock isolados. Criar uma capacidade autenticada e estrita no processo que detém o socket vinculado; o controlador deve aceitar somente os estágios e o lote selados, nunca `force` nem rota administrativa genérica.
3. Selecionar no máximo uma etapa física por ciclo. `guide`, `in_transit` e `ready_for_pickup` exigem prova logística atual e dedupe persistido. `PICKUP_BONUS` exige entrega/retirada canônica comprovada e recibo separado; não liberar bônus apenas por `READY_FOR_PICKUP`.
4. Testar em simulação seleção, ausência de candidato, estado divergente, atendimento humano, replay, lock concorrente, falha do provedor, resultado incerto, ausência de bônus sem prova e zero mensagens no `dry-run`.
5. Passar preflight selado no release materializado, executar `dry-run` autenticado, conferir recibos e só então substituir o controlador V203 com rollback pronto. Um único ciclo real pode ser permitido após esses gates, seguido de repetição que comprove zero reenvio.

## Estado final desta auditoria

Nenhuma release, flag, timer, rota, banco ou mensagem de produção foi alterada. V269 continuou ativo com health HTTP 200. V203 permaneceu inativo; pós-venda automático não foi liberado. Não declarar o sucessor V270 criado ou funcional com base apenas nos testes históricos.
