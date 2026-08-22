# Freeze V48 — Core multiproduto Ecuador

A V48 sucede a V47 e torna explícitos os contratos independentes de produto,
origem, responsável humano, identidade do cliente e auditoria do painel.

- `vslProductKey`: origem histórica; não é reescrita por troca manual.
- `productKey`: produto da negociação atual.
- `productRouteLock`: decisão atual protegida, inclusive seleção manual.
- `assignedAgent`: identificador humano/equipe ou `null`; nunca produto.
- produto desconhecido: fila `review`, sem fallback comercial.
- nomes: manual verificado, nome submetido, perfil do provedor e telefone.
- conflito de nomes: `IDENTITY_CONFLICT`, resolvido somente no painel.
- auditoria: transição material com hashes determinísticos; leitura não grava.

Origens oficiais preservadas:

- `/protocolo-g` e `/n/` → Tex Ultra Ecuador;
- `/m/` → Vit Power Ecuador;
- Nitrix explicitamente identificado → Nitrix Oxide Ecuador.

A release não autoriza canário real, envio WhatsApp, Dropi, Meta/CAPI, mudança
de transporte, scheduler/mídia, pedidos históricos ou qualquer alteração na VSL
externa. O saneamento de dados exige dry-run, backup e confirmação nominal.
