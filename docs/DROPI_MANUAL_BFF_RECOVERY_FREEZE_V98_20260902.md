# Congelamento V98 — recuperação manual Dropi BFF EC

## Objetivo

Autorizar a integração do envio manual individual da Dropi Ecuador com a BFF
oficial atual sobre a base operacional `bb5bf3d`, preservando a pesquisa
idempotente imediatamente antes do único `POST` e registrando somente o motivo
sanitizado de uma eventual rejeição lógica.

## Escopo autorizado

- adaptador para `https://api-v2.dropi.ec/bff/orders` e listagem BFF oficial;
- reaproveitamento da sessão oficial persistida fora do release;
- pesquisa por referência/telefone antes do envio e após resposta ambígua;
- classificação do erro sem token, e-mail ou telefone completo;
- rota administrativa manual já existente, com autorização em dois cliques.

## Preservado

Não foram alterados VSL, preços, checkout, produto, funil, Meta/CAPI, Pixel,
número oficial, transporte WhatsApp, mensagens, áudios, imagens, schema do banco,
schedulers de pós-venda ou qualquer projeto/país externo ao Ecuador.

O scheduler continua proibido de criar pedidos na Dropi. A V98 não ativa
sincronização mutante nem automação de pós-venda; essas decisões permanecem
submetidas ao contrato V66 e a autorização operacional separada.

## Operação controlada

O envio real continua exigindo seleção manual individual no painel, autorização
explícita e confirmação final do operador. Antes de nova tentativa, a listagem
BFF deve provar que o pedido ainda não existe. Depois do envio, somente um ID
Dropi confirmado pode encerrar a revisão manual.

## Rollback

Retornar o symlink `/opt/vitalismen-automacao/current` ao release anterior e
recriar somente o processo PM2 `vitalismen-automation` apontando para o `current`
restaurado. Nenhuma migração de banco é necessária.
