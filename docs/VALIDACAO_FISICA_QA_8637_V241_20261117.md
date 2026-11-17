PROJECT=VITALISMEN_EC — VITALISMEN OFICIAL

# Entrada real e resposta automática do QA 8637 — 17/11/2026

STATUS=PASS_PHYSICAL_ENTRY_ONE_AUTOMATIC_REPLY_DELIVERED

A entrada real `Hola` foi recebida às 16:01:38 de São Paulo (2026-11-17T19:01:38.292Z UTC), ID `3EB0761AE4696B3E5BB38A`, pela sessão/identidade oficial Z-API. A janela estava válida e a entrada foi aceita pelo contexto QA.

O bot respondeu às 16:02:42 (2026-11-17T19:02:42.428Z UTC), ID `844D4C9CE16BD079D36B`. Conteúdo: **Hola, ¿en qué puedo ayudarte hoy con Vit Power Ecuador?**. ACK 2 confirma entrega; não é apresentado como confirmação de leitura. O ledger está `sent`, ligado ao mesmo ID de saída, com retry automático proibido. A memória do agente liga esse ID à entrada exata e registra sucesso da IA real. Houve uma entrada e uma resposta, sem intervenção de envio manual pelo agente ou pelo painel neste teste.

## Correção operacional aplicada ao teste

O envio anterior das 15:37 chegou após vencer a primeira janela. O `Hola` das 15:47:56 chegou dentro da janela seguinte, mas o cadastro QA tinha Tex Ultra como produto da negociação, apesar da origem Vit Power. O fluxo Tex Ultra marcou `tex_ultra_customer_question` e colocou esse contato em atendimento humano, sem resposta entregue. Essa falha foi investigada; não foi apresentada como PASS.

No painel oficial, foi selecionado e salvo Vit Power somente para o telefone de QA 8637. Produto atual, rascunho e lock da negociação passaram a `vit_power_ec`; a origem Vit Power e a memória Tex Ultra foram preservadas. Nenhum site, cliente diferente, regra global, preço ou código foi alterado por esse ajuste de cadastro. A seleção de um contato no painel foi conferida no arquivo oficial: abre/carrega a conversa, sem chamar Assumir.

A prova física válida é a nova entrada das 16:01:38, não uma reinjeção das anteriores. Nenhuma mensagem histórica foi reprocessada. Registro da mudança em `PRODUCT_CORRECTION.json` e evidência final em `FINAL_PHYSICAL_PASS.json`.

## Tempo e limites da prova

A resposta ocorreu 64.136 segundos após a persistência da entrada. Esta é uma conversa antiga; B01 não foi repetido e o agrupador aguardou o minuto de silêncio existente. **Este ensaio não prova saudação em 5–30 segundos para um cliente novo.** Esse cenário foi validado em simulação isolada na entrega V241 R2; sua comprovação física permanece separada.

Esta prova cobre WhatsApp → recebimento persistido/roteamento → IA → envio automático → recibo de entrega. Não comprova nesta execução uma nova visita à VSL, atribuição Meta, resposta a perguntas comerciais ou fechamento físico. O ensaio isolado completo do funil permanece registrado na auditoria de publicação, sem ser apresentado como teste físico.

## Encerramento e preservação

Janela encerrada pelo CLI oficial após a entrega, com restauração do modo manual anterior somente no QA. Histórico, flags de teste e proteção noDropiEver preservados. Zero pedidos para o contato. Não houve liberação em lote, remoção de ledger, repetição de mídia, alteração de outras VSLs ou reinício da aplicação nesta validação.

Release `/opt/vitalismen-automacao/releases/20261117T164134Z_production-20261117-135d17c`, commit `135d17cc75d71b7401c7f1e9400759e913ad867b`, PID 3806818, online. Código/configuração publicados e congelados continuam na entrega V241 R2. O backup global MongoDB permanece FAIL por consistência; esta prova não muda esse resultado.

Evidências desta etapa: `C:\Users\Wolfe\Backups\VITALISMEN_EC\QA_FINAL_VALIDATION_V241\20261117T185608Z` e `/opt/vitalismen-automacao/backups/ec-qa-8637-20261117/qa-v241-20261117T185608Z`. Próxima etapa: perguntas livres, com nova janela de teste combinada; QA nunca deve gerar pedido, Dropi ou Purchase real.
