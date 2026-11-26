# EC V274 — canal estável para substituição controlada do WhatsApp

## Publicação validada em 2026-11-26

A V274 foi ativada no VPS oficial como `20261126T024208Z_production-20261126-4d8efd8`, commit `4d8efd8cb2464e434c43fbcfbbb145eb1555b873`, árvore `3029cfcbb0f85dc49cce952517bfec0dbe82ac64`, com autoridade sucessora `ec-primary-channel-v274-r4`. O tag Git `ec-primary-channel-v274-20261126` fixa o commit. A release V271 `20261125T040212Z_production-20261125-7020adb` permanece íntegra para rollback. O backup de ativação está em `/opt/vitalismen-automacao/backups/ec-primary-channel-v274-20261126T024208Z`, com acesso root.

O `senior:check` completo no release materializado passou: baterias de 43, 482 e 22 testes, todas com zero falhas, além dos guards finais. O lint de sintaxe passou em 1.271 arquivos. A verificação estrita da cadeia selada confirmou os 12 arquivos alterados. Após a ativação, `current` e o diretório real do processo PM2 apontaram para V274; a API e o painel público responderam HTTP 200; o health informou `online` e uma sessão WhatsApp conectada. O vínculo `EC_PRIMARY` ficou na geração 1, sem conta pendente. O ciclo de pós-venda em `dry-run` teve zero envio físico, e o timer V203 permaneceu inativo.

Esta publicação não prova uma mensagem nova de cliente recebida e respondida após a troca, nem um pareamento de número substituto. A futura troca de conta continua condicionada ao estágio QA e aos recibos reais de entrada e saída antes de ativar outra geração. O envio manual de mídia também continua sujeito à prova própria registrada no `AGENTS.md`. O texto abaixo preserva o histórico de preparação da candidata; as frases sobre V271 ativa descrevem o estado anterior à publicação.

## Objetivo e fonte

O painel V273 já avisa quando a sessão cai. Esta candidata separa o canal lógico `EC_PRIMARY` da conta WhatsApp efetivamente vinculada, mantendo o `sessionId` legado como identificador técnico imutável para não reescrever mensagens, pedidos ou afinidade de contatos. Foi comparada com os arquivos da release V271 ativa antes da edição; os hashes de `ecBotCoreRuntimeIntegrationV78Service.js`, `connection.js`, `outboundGuard.js` e `routes/whatsapp.js` eram idênticos entre checkout e produção.

## Mudança candidata

- `src/whatsapp/ecPrimaryChannelBinding.js` lê um vínculo persistido fora dos releases. Exige arquivo regular, root, modo 0600, tamanho limitado e contrato válido. O vínculo guarda canal, ID técnico legado, geração ativa, número real aprovado, possível número pendente e gerações anteriores.
- Entrada e saída verificam a conta real conectada contra a geração ativa. Uma conta pendente pode conversar somente com o telefone QA `5515998038637`; clientes reais ficam bloqueados até a ativação. A ausência ou corrupção do vínculo, quando exigido, falha fechada.
- A autorização de escrita de pedidos pelo inbound do dispositivo vinculado usa a mesma geração ativa. A conta pendente, a conta antiga e uma conta não aprovada não ganham permissão de escrita.
- `scripts/ec-primary-channel.mjs` oferece `show`, `init`, `stage`, `activate` e `abort`. `stage` lê a sessão conectada e exige o número esperado; `activate` exige a mesma conta e prova de inbound e outbound QA persistidos no Mongo depois do estágio. A troca é registrada como nova geração; o histórico anterior permanece.
- O registro de mídia inbound passa a gravar `ownerPhoneDigits` do socket real, separado do `sessionId` legado.
- A autenticação Baileys e o diretório atual não são movidos por esta candidata. O procedimento de re-pareamento continua sendo uma operação separada com backup e QR novo.

O vínculo inicial foi criado no VPS em `/opt/vitalismen-automacao/shared/runtime/whatsapp-channel/ec-primary.json` com a sessão conectada verificada. O diretório tem modo 0700, o arquivo modo 0600; a geração é 1, sem conta pendente nem histórico arquivado. A release V271 ativa ainda não lê esse arquivo.

Após acrescentar a verificação de escrita de pedidos, os oito testes direcionados passaram no Windows e na candidata materializada no VPS (`2e0fe686`). O lint de sintaxe passou para 1.273 arquivos. `npm run senior:check` na candidata falhou em `ecRepurchaseSqliteSerializationFreezeRuntimeGuardV47.js` com `herança divergente em .github/workflows/ec-panel-quality.yml` antes de executar o restante da suíte. A autoridade V271 ativa ainda vincula commit, árvore, hashes e release antigos; suas capacidades Tex também contêm números de identidade fixos. A V274 precisa de sucessor selado que preserve a cadeia histórica e aceite explicitamente o novo vínculo de canal. A conexão e o health do V271 não constituem prova de ativação da candidata.

## Contrato de troca futura

1. Preservar o vínculo ativo e fazer backup do diretório de autenticação. Manter atendimento humano no celular durante a troca.
2. Gerar uma sessão nova sob o mesmo ID técnico, parear o aparelho substituto e conferir `ownPhoneDigits` no status real. Esta etapa não autoriza mensagens comerciais.
3. Executar `stage` com geração e número esperados. Somente QA passa pela nova conta.
4. Com QA, comprovar uma entrada, uma resposta com recibo do dispositivo e persistência. Executar `activate` somente se o script encontrar esses registros; conferir ausência de duplicidade.
5. Atualizar separadamente o destino público da CTA se o número comercial mudou. O QR de pareamento não altera o link de WhatsApp da VSL. O histórico de conversa do painel continua consultável pela identidade do cliente e pelos IDs antigos; não prometer migração automática do histórico dentro do aplicativo WhatsApp.

## Preservação e limites

VSL, cloacker, texto da CTA, número público, funis, mídia automática, pedidos, Dropi, Meta, filas e Z-API não foram modificados nesta candidata. Não há reenvio de mensagens nem migração de dados históricos. A release V271 e a página pública V273 permanecem ativas até que um sucessor selado com hashes próprios seja materializado e os testes de produção passem.

Um QR universal não existe: cada conta precisa autorizar um novo pareamento. O canal estável evita alterações no código de inbound/outbound a cada troca, mas a mudança de número público ainda exige conferir o destino da VSL.
