# VITALISMEN_EC — Pedidos, Dropi, pós-venda e QA V252

Autorização: pedido explícito de 2026-11-19 para corrigir gravação em Atendendo, confirmação, recompra, integração Dropi, pós-venda e indicação antiga do contato de teste. `Please implement the plan.` confirma a implementação do escopo. Este documento não autoriza nova janela QA, replay histórico ou liberação de outros contatos.

## Fonte e limite da alteração

Pai real: `76dc26f89393d694db9d8b3d95447fc7144f89f6`, `/opt/vitalismen-automacao/releases/20261119T031453Z_production-20261119-76dc26f`. Sucessor publicado e ativo: `959674ce88eed400012b57b28fdef4c6838869b5`, `/opt/vitalismen-automacao/releases/20261119T160921Z_production-20261119-959674c`. A publicação e ativação só existem quando comprovadas pelos recibos finais; este rascunho não as declara concluídas.

O contrato `docs/freeze/ec-orders-dropi-postsale-v252-contract.json` lista os únicos 20 arquivos do sucessor. As dez alterações de backend existente podem ser invertidas exatamente por `ops/publications/ec-orders-panel-v252/backend-delta.json`. O painel e Leads usam suas fontes públicas reais, incluindo edições manuais concorrentes, com reversão em `STATIC_BUILD.json`. A API legada completa permanece privada; apenas o patch pontual é versionado.

## Comportamento autorizado

1. Dados incompletos permanecem em Atendendo; confirmação válida exige pedido nativo completo e leitura após gravação. A API legada recusa transição direta para confirmado, evitando uma confirmação apenas visual.
2. Nova confirmação válida depois da ativação grava uma tentativa persistente na fila serial existente de Dropi. Apenas o próprio pedido pode ser alterado. Crash, erro ou retorno incerto não rearmam o envio.
3. Recompra cria novo ID e conserva o pedido anterior. Uma venda manual externa entregue pode fornecer a identidade verificada da compra anterior, sem criar retrospectivamente um Mongo Order ou importar snapshot comercial.
4. Vendas existentes na Dropi são vinculadas somente por rota nativa autenticada e grant de raiz de até 30 minutos. Pedidos nativos existentes conservam ID, produto, quantidade, valor e dados do cliente; o vínculo resolve apenas a falha de preflight/envio comprovadamente substituída por recibo remoto. O espelho do contato usa CAS de versão e campos pontuais para não sobrescrever memória ou uma negociação concorrente. Não cria pedido externo ou Purchase histórico.
5. O pós-venda mantém executor, timer, janela do Equador, locks, histórico e limite de uma saída física por ciclo. A reconciliação limitada inclui pedidos ativos com guia. A seleção de retirada e lembretes usa as fontes carrier_tracking/dropi_orders_api já aprovadas em V168B, mantendo identidade, guia, agência, disponibilidade verificada, ledger e pausas. Quando a Dropi informa estado final, a consulta da transportadora continua e avisos logísticos anteriores ficam bloqueados; agradecimento e conclusão exigem a evidência real da transportadora, sem transformar status comercial em prova de entrega. O catálogo da API oficial EC usa país ECUADOR; os três IDs e depósitos existentes foram encontrados na consulta oficial e a cotação nativa dos dois pedidos atuais foi validada sem criação de pedido. A sessão Dropi é renovada somente quando necessário e após verificar a mesma conta/país e conservar a geografia; resultado incerto não provoca repetição automática.
6. O contato QA permanente fica em Testes, fora de Novas, alertas e contadores comerciais, sem apagar histórico ou alterar a validade real da janela. Continua impedido de gerar Order, Dropi ou Meta.

## Preservado

Os cortes V251 de convite após entrada WhatsApp recebida e sem checkout antecipado; saudação Tex V249; CTA e indicação real QA V248; mensagem limpa V245; player/VSL/desktop/móvel, preços, mídias, voz, produto de origem e produto do pedido, motor comercial, memória e dados anteriores, Z-API, Meta, opt-out e pausas humanas. Nenhuma infraestrutura foi recriada. Nenhum cron novo ou scheduler legado foi ligado. Congelamento de código não pausa a operação.

## Verificação e recuperação

Exigir os recibos reais de regressão completa, rotas nativas em Mongo/SQLite privados e rede isolada, navegador, preservação dos arquivos protegidos, inversões exatas, gates negativos e backup criptografado com descriptografia, hashes, metadados e rejeição de adulteração. Retentativas de ensaios e candidatos substituídos continuam preservados; não são recibos de produção. Ensaios não equivalem a entrada física WhatsApp ou conversão Meta real.

Código/configuração e preimagens dos casos EC autorizados são recuperações separadas. O backup global MongoDB permanece FAIL; não há alegação de restauração global validada.

## Publicação, congelamento e rollback

Recibos de código, estáticos, ativação e reconciliação ficam em `/opt/vitalismen-automacao/backups/ec-orders-dropi-postsale-v252-20261119-r11/`. Fonte pública e controlador estão em `ops/publications/ec-orders-panel-v252/README.md`. A origem Git oficial é mantida; refs isoladas e tags exatas não alteram a branch production nem o índice local de trabalho do operador.

Rollback de código/configuração: executar o controlador V252 com `rollback`. Primeiro ele inverte e verifica os arquivos públicos; depois restaura release pai, ambiente PM2 e configuração anterior do executor. Alteração concorrente bloqueia sobrescrita. Rollback não reverte pedido entregue, apaga ledger, reabre QA ou repete envios. Restauração dos dados de uma venda requer análise específica das preimagens, não um reset automático.

## Resultado final observado em produÃ§Ã£o

- 547 testes de regressÃ£o completa, 109 focados, 66 de preservaÃ§Ã£o V219, 15 cenÃ¡rios nativos, 3 da fila completa, 8 verificaÃ§Ãµes de navegador, 45 operacionais e 31 gates negativos aprovados. A fronteira do navegador/provedor foi simulada no teste completo da fila; duas cotaÃ§Ãµes nativas reais e o catÃ¡logo EC foram consultados sem criar vendas.
- TrÃªs vendas existentes retornaram `submitted`, ID Dropi correto e `pedido_enviado`, inclusive depois da execuÃ§Ã£o do pÃ³s-venda. Dois vÃ­nculos usaram a rota nativa autenticada. O recibo GINTRACOM exigiu manutenÃ§Ã£o administrativa pontual com comparaÃ§Ã£o de versÃ£o e campos exatos, backup criptografado antes e depois e preservaÃ§Ã£o da guia alfanumÃ©rica e transportadora reais. NÃ£o alterou cÃ³digo ou guard do bot. Um alias de leitura legado da venda externa foi completado com o ID jÃ¡ comprovado. NÃ£o criou Mongo Order histÃ³rico, pedido externo ou evento Purchase.
- Executor existente: snapshot, simulaÃ§Ã£o e execuÃ§Ã£o real PASS; cinco registros Dropi atualizados no ciclo manual auditado e nenhuma saÃ­da fÃ­sica elegÃ­vel nesse ciclo. Janela aberta, Z-API conectada, limite de uma saÃ­da e bloqueios preservados. O timer existente tambÃ©m executou ciclos PASS. AusÃªncia de candidato elegÃ­vel nÃ£o autoriza forÃ§ar contato ou repetir mensagens.
- Fontes de QR, Leads e API legada verificadas no VPS; QR e Leads responderam HTTP 200. A resposta pÃºblica inclui somente um mÃ³dulo de analytics acrescentado pela Cloudflare alÃ©m dos bytes publicados; a remoÃ§Ã£o exclusiva desse mÃ³dulo observado reconstitui o hash exato da fonte. Os guards antigos passaram por inversÃ£o exata, sem troca dos baselines.
- RecuperaÃ§Ã£o verificada de cÃ³digo/configuraÃ§Ã£o antes e depois, incluindo 97 arquivos no pacote final e ambiente PM2; dados de cinco Orders, seis Shipments, sete ContactStates e trÃªs leads EC; arquivo de auditoria de 44 arquivos. Descriptografia, hashes, metadados e adulteraÃ§Ã£o rejeitada PASS; chave privada nÃ£o enviada e conteÃºdo descriptografado nÃ£o escrito no disco local.
- Falhas de fixture, comprovante concorrente, leituras preliminares e candidatos substituÃ­dos permanecem preservados. O comprovante concorrente foi devolvido ao conteÃºdo originalmente selado antes da ativaÃ§Ã£o; nenhum hash de binding foi alterado para liberar o gate.

Os comprovantes privados e preimagens ficam somente no diretÃ³rio de evidÃªncias e nos arquivos criptografados. Este documento e o manifesto publicam contagens e hashes, sem registros pessoais ou credenciais. A operaÃ§Ã£o continua apÃ³s o congelamento. O contato 8637 permanece em Testes, sem reset ou reabertura de janela.

Limites mantidos: entrada fÃ­sica nova do WhatsApp e primeira conversÃ£o Meta real atribuÃ­da nÃ£o foram inventadas; nÃ£o hÃ¡ prova global de restauraÃ§Ã£o MongoDB. O backup global permanece FAIL, separado das recuperaÃ§Ãµes aprovadas desta alteraÃ§Ã£o.
