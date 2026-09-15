# V152-E-R1 — Canal Web real de teste separado

Data: 2026-09-12

Esta microcamada sucede a V152-E e fixa a identidade do único canal Web autorizado:

- telefone: `5531983002800`;
- channelId: `V152_TEST_WEB_01`;
- namespace persistente: `V152_TEST_WEB_01`;
- provider: `WHATSAPP_WEB`;
- QA inbound/outbound: `5515998038637`;
- shadow: `true`; draining: `true`; weight: `0`; capacity: `0`.

O helper recusa qualquer linha diferente e, se a divergência for descoberta após o
scan, executa logout e remove somente a sessão de teste. A sessão é criada pelo
`SessionManager` V152 fora da release. O QR permanece como PNG efêmero root-only,
sem terminal, logs, banco, Git, freeze ou receipt.

O processo é one-shot e independente do PM2. Depois do pairing, um novo processo
deve restaurar a sessão sem QR. O inbound aceita uma única mensagem do QA, não
persiste corpo e não chama bot. O outbound envia um único texto fixo ao QA; o ledger
persiste a intenção e a segunda tentativa registra `DEDUPED` com zero provider call.

A projeção Connections é evidência sanitizada e mantém o canal inelegível no router.
O painel core de produção não é alterado nem ativado por esta fase.

Produção continua em Z-API com a linha `5531971862958`. O telefone antigo
`5515991418416` permanece bloqueado. Não há migração, atribuição, handoff, failover,
cutover, drain ou desligamento da Z-API. VSL, Pixel/CAPI, Funnel Metrics, lógica de
negócio, painel core e pós-venda são comparados contra o snapshot antes/depois.

Se todas as provas reais passarem, o gerador
`scripts/v152-e-r1-operational-receipt.mjs` emite somente metadados e hashes. Nunca
inclui QR, cookies, auth state, tokens, chaves de sessão ou conteúdo sensível.

Próxima fase possível: `V152_F_CONTROLLED_CANARY_DESIGN`, sempre dependente de nova
aprovação humana. Esta autorização nunca permite cutover.
