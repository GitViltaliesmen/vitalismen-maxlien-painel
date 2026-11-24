# EC WhatsApp: migração da Z-API para dispositivo vinculado

Status em 2026-11-23: **PREPARAÇÃO LOCAL; NÃO PUBLICAR**.

O operador autorizou substituir a Z-API sem renovação por uma sessão do mesmo WhatsApp Business, com texto automático e painel na primeira etapa. Mídia e pós-venda não entram nessa primeira ativação. O telefone de QA `5515998038637` não é cliente e nunca deve criar pedido ou conversão.

## Verificação do release ativo

- Release oficial consultado: `20261121T172300Z_production-20261121-d6a815d`.
- A Z-API respondeu HTTP 400 com indicação de assinatura pendente. Isso impede tratá-la como caminho de saída funcional.
- O processo principal segue online. `WHATSAPP_CONNECT_ENABLED=false` e não existe autenticação persistida para a identidade ativa no diretório compartilhado inspecionado.
- O perfil `EC_BOT_CORE_OPERATIONAL` da V78 exige Z-API e exige `WHATSAPP_CONNECT_ENABLED=false`. A guarda de Mongo requer contexto de escrita do webhook Z-API. Abrir apenas o socket Baileys perderia a persistência e os recibos da jornada.
- A medição Tex V243 exige `provider=zapi`, `sessionId=zapi` e contexto HTTP do webhook. A troca precisa de uma prova de inbound própria, mantendo o mesmo `TX243` e sem reenviar eventos passados.
- O painel consulta `/api/zapi/status`; precisa consultar o transporte selecionado e mostrar o QR autenticado da nova sessão.

## Alterações ainda necessárias antes de ativar

1. Registrar um sucessor selado do perfil operacional que autorize o socket e **somente** as escritas e efeitos necessários do inbound autenticado, com uma identidade EC e uma única rota de saída. Preservar a V78 histórica.
2. Criar o vínculo persistente da sessão em `/opt/vitalismen-automacao/shared/runtime/whatsapp-auth/`, validar o número após leitura do QR, e provar reconexão após reinício sem pedir novo QR.
3. Adaptar inbound, ACK, leitura de mensagens, estado e deduplicação à prova do Baileys; adaptar a V243 sem assumir que uma mensagem do socket veio da Z-API.
4. Fazer a interface consultar o transporte ativo. No modo inicial, ao chegar a passo com áudio/imagem, parar o avanço automático e registrar passagem ao humano, sem repetir o passo nem gerar texto substituto.
5. Validar com o número de QA uma entrada, uma resposta em texto, persistência após recarga do painel, mesmo ID de mensagem, bloqueio de duplicidade e reconexão. Nenhum pedido/Dropi/Meta para QA.
6. Só depois da prova real, publicar a autoridade selada, trocar uma vez o roteamento oficial, conferir PM2 no release ativo e retirar a Z-API do caminho. Se a sessão falhar, manter atendimento manual no aplicativo até correção; não reenviar automaticamente resultado ambíguo.

## Preparação no checkout isolado

O modo de transporte explícito mantém `zapi` como padrão. O valor `baileys_text` desabilita a seleção de Z-API na borda de saída, remapeia a sessão histórica simbólica `zapi` somente na consulta de socket e exige armazenamento durável fora do release em produção. **Isso não completa a migração. Não ativar o modo ainda.**

## Complemento local de segurança em 23/11

- O modo `baileys_text` agora recusa áudio, imagem, vídeo e documento na borda de envio; o modo atual `zapi` não muda.
- No funil inicial Tex, uma etapa de mídia no modo novo pausa a cadência, grava o motivo e entrega o contato ao humano, sem avançar nem repetir a etapa. A entrada seguinte não desfaz automaticamente essa passagem.
- O teste unitário do seletor e a verificação de sintaxe passaram. `npm run senior:check` no Windows parou antes dos testes por depender de `/usr/local/lib/vitalismen-deploy/gira21x-sealed-successor-v1.mjs`, instalado no Linux oficial.
- O endpoint autenticado `/api/whatsapp/status` identifica o transporte selecionado. O painel usa o estado e o QR do dispositivo vinculado somente quando esse modo estiver ativo; no modo atual mantém a leitura Z-API. O JavaScript inline passou na análise de sintaxe e os testes V37 de autenticação e do seletor passaram.
- Ainda faltam autorização selada do socket no runtime, persistência autenticada de inbound e ACK, prova da identidade da sessão, reconexão e QA real do bot. A leitura de status/QR e a prova `TX243` foram preparadas localmente, mas não foram ativadas. **Nenhum arquivo desta candidata foi publicado; Z-API e PM2 de produção permanecem como estavam.**

## Prova de entrega e medição TX243

- O operador confirmou em 23/11 que a mensagem da CTA chegou ao WhatsApp Business no celular. O print mostra a frase inicial Tex e uma referência `TX243` às 20:41. Esta é prova de entrega no aplicativo, **não** de entrada no bot ou persistência no painel.
- A candidata aceita prospectivamente a prova `TX243` de um inbound Baileys somente com contexto de socket autorizado, ID da mensagem, sessão e número proprietário exatos, além da mensagem persistida. O registro do inbound inclui `provider=baileys` e o proprietário da sessão. O caminho Z-API mantém suas condições e identificadores anteriores.
- Os 13 testes isolados da medição, incluindo os legados Z-API e os novos casos Baileys, passaram em diretório temporário no Linux oficial, sem mensagens, pedidos ou eventos Meta reais. O journal de produção não foi tocado. A execução direta desses testes no Windows falha nas permissões POSIX exigidas pelo journal; isso não representa aprovação do runtime ou da publicação.

## Limites da candidata de ingresso V265

- Há uma preparação local, ainda sem publicação, para receber apenas eventos novos (`notify`) do socket oficial. Ela exige número proprietário e socket conectados, contexto V78 e autoridade de sucessor selado. A autoridade V265 ainda não foi emitida: selecionar `baileys_text` agora deve falhar sem abrir a entrada do bot.
- O modo novo recusa a entrada Z-API e a saída Z-API, e pausa contato que alcance etapa automática de mídia. A passagem ao humano grava o bloqueio de reenvio automático; envio manual autenticado continua possível.
- O filtro V75, quando ativo, só admite o telefone de QA. Antes de autorizar clientes reais, o sucessor precisa tratar esse filtro e as permissões de gravação de pedidos de forma explícita e testada. Contornar somente o filtro do dispatcher não liberaria o funil completo.
- Faltam recibo de saída/ACK no novo transporte, saúde do painel coerente, reconexão após reinício, autorização selada e teste real completo do bot. A entrega confirmada no celular não satisfaz esses critérios. Não ativar nem declarar concluída a migração.

## Verificação complementar

- O operador confirmou a chegada da mensagem de QA no WhatsApp Business. O atendimento manual pelo aplicativo e WhatsApp Web pode receber o tráfego da CTA atual; o cliente precisa enviar a mensagem. Isso não comprova resposta automática nem persistência no painel.
- A candidata local passou a escolher Baileys na saúde apenas quando `baileys_text` for selecionado e a exibir a sessão vinculada no painel, sem rotular a Z-API como canal ativo nesse modo. O modo padrão `zapi` conserva a interface anterior.
- A validação de produção usa `ec-order-v254-validation-sealed-v256-r1.mjs`, não o antigo verificador `gira21x`. A execução direta de `senior:check` não é o preflight oficial: o perfil V256 exige launcher e isolamento de rede próprios. Uma execução isolada passou pelos guards históricos até V127, mas foi encerrada no limite de 120 segundos; não constitui aprovação integral.
- O PM2 `vitalismen-automation` permaneceu online no release `20261121T172300Z_production-20261121-d6a815d`. Nenhum restart, deploy, troca de transporte ou envio pelo bot foi feito nesta preparação.

## Diagnóstico do QA recebido sem resposta

- O webhook Z-API registrou a mensagem de QA `AC9A7E2E100F21DDBFA31D8BB750A3F4` em 2026-11-23T23:41:12Z, request `77a85f52-e14b-45b3-9efc-bae40460f659`. A mensagem aparece no painel.
- O claim V78 retornou `persistenceAllowed=true`, `automationAllowed=false`, motivo `principal_sdr_qa_window`, com zero contatos correspondentes ao filtro de continuação. A primeira interrupção comprovada dessa mensagem foi a autorização do QA, antes do roteamento da resposta.
- A saúde local de produção registrou `zapi_not_connected`, `transport=zapi`, `ready=false`. Mesmo com um claim de QA válido, o transporte oficial atual não está pronto para saída automática. Uma mensagem de QA não prova o comportamento de todos os clientes reais.
- Este diagnóstico não autoriza remover o filtro de QA nem simular uma resposta. O atendimento humano pelo WhatsApp Business permanece o caminho operacional enquanto a migração do dispositivo vinculado não for publicada e testada.

## Autorização de conclusão e dependências do sucessor

- O operador autorizou concluir a migração. A saúde do runtime ativo ainda aponta `transport=zapi`, `ready=false`, `zapi_not_connected`. Logs recentes de clientes reais mostram rejeição de texto e áudio pela assinatura da Z-API (`must subscribe to this instance again`). Entrada persistida e saída automática são etapas distintas.
- O commit candidato descende do commit funcional `d6a815d`, porém a autoridade externa V256 só registra releases exatos. O preloader e o helper de reinício da candidata ainda importam `ec-order-v254-validation-sealed-v256-r1.mjs`. Um novo commit com esses arquivos não constitui, sozinho, sucessor autorizado.
- O sucessor V265 precisa registrar commit, árvore, delta, hashes, perfil de transporte, número e autorização de escrita do socket; incluir leitura de status/QR, recibo de saída, teste de persistência e rollback. O parente V256 e a cadeia de freezes devem permanecer verificáveis. Não alterar `current` ou PM2 com a candidata atual.
- O teste `senior:check` executado por `unshare -n` passou pelos guards históricos até V127, mas terminou por timeout de 120 segundos. Resultado integral: PENDENTE. O teste funcional com o mesmo número ainda requer QR vinculado e uma mensagem nova após o sucessor aprovado.

## Recibos de saída e escrita de pedidos na candidata

- A candidata local exige ID de recibo de `sendMessage` no modo `baileys_text` e grava provedor e ID na reserva persistida de deduplicação. Se a API do dispositivo não devolver ID ou a gravação falhar depois do envio, o resultado fica ambíguo e o código não repete automaticamente a mensagem. O caminho Z-API mantém seu formato anterior.
- A gravação de pedido a partir de inbound do dispositivo fica limitada a contexto de socket verificado, número oficial, mensagem identificada, cliente EC real e operações `insertOne`/`updateOne` na coleção `orders`. O contato de QA não ganha permissão para criar pedido.
- Nove testes locais direcionados passaram, inclusive os casos de recebimento TX243, passagem de mídia ao humano, recibo e permissão restrita de pedido. A sintaxe dos módulos alterados passou. Esses testes não comprovam pareamento, resposta real nem autorização do sucessor.
- O filtro de canário V75 ainda pode impedir clientes reais em entrada, roteamento e saída. A autoridade V265 precisa tratar essas superfícies explicitamente, com teste negativo para outro país e para o número de QA em pedidos. Nenhuma publicação ou troca de transporte foi feita nesta etapa.

## Escopo de resposta automática no sucessor

- A candidata libera clientes EC no filtro V75 somente nas superfícies de entrada do dispatcher, roteamento da conversa e saída de texto, quando `baileys_text` estiver selecionado **e** a autoridade V265 corrente estiver presente. Mídia, automações de campanha e outros países não recebem essa exceção.
- O roteador só aceita resposta automática fora da antiga lista de QA quando o contexto do inbound contém a prova do mesmo remetente EC e do socket verificado. A ausência da autoridade mantém as travas anteriores. Testes negativos cobrem transporte Z-API, remetente divergente, QA e país não EC.
- A autoridade V265 ainda não foi instalada. Sem ela, essas exceções não entram em vigor e o release não deve ser ativado.
