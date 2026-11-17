PROJECT=VITALISMEN_EC — VITALISMEN OFICIAL

# Percurso VSL → WhatsApp → checkout → compra — V237-R2

Registro final UTC: 2026-11-17T02:18:07.256063+00:00. Publicação pontual autorizada para `https://taviazen.shop/vitpower_2026g`. A página `https://plusmen.shop/tex` foi consultada somente para leitura; nenhum ativo, campanha ou sistema de outro projeto foi alterado.

## Causas comprovadas

1. As vendas `EC-MWIX6BWG-FGFW` (final 2833) e `EC-MWJFDEN7-Y1WB` (final 7253), ambas de um frasco por USD 39,99, possuem recibo de aceite de Purchase no destino legado **920532663934291**. Não possuem vínculo com visita V213 nem fbp/fbc/IP/UA do visitante no pedido. O destino da página e da campanha inspecionada é **28298613626504767**, MANUELA_SANTOS_LATAM_EC. Não era ausência de venda no banco.
2. A remoção anterior de `Visita: VP-…` eliminou o canal de correlação da página anônima com a mensagem WhatsApp. O texto limpo foi preservado; não se presumiu identidade por horário, nome ou IP.
3. O observador de checkout estava ligado a caminhos do motor anterior. A persistência do pedido pelo atendimento livre ou pela edição da ficha precisava ser observada também no modelo central.

As duas vendas históricas não foram reenviadas ou atribuídas artificialmente. Seus recibos, pedidos Dropi e atendimento humano permanecem preservados. Não se promete que a correção futura fará vendas antigas aparecerem retroativamente no anúncio.

## Alterações publicadas

- O formulário existente solicita o WhatsApp de Ecuador que será usado no envio; o primeiro nome permanece opcional. O telefone passa somente pelo proxy protegido do próprio site. A mensagem comercial segue limpa, sem Visita/VP, cookies, IDs publicitários ou telefone concatenado.
- A visita armazena hash do telefone declarado e hash da mensagem revisada pelo cliente. O vínculo só é reclamado por entrada Z-API persistida do mesmo telefone EC, sessão e proprietário oficiais, com a mensagem correspondente e uma única candidatura válida. Há prazo, conflito, ambiguidade e exclusão de QA/estrangeiros. Isso comprova a correspondência com o número remetente; não constitui verificação OTP do navegador.
- `InitiateCheckout` observa a primeira quantidade/produto/valor persistidos no rascunho ou memória de pedido livre. Abertura de página, clique, formulário vazio e resumo sem confirmação não viram Purchase. Estados de compra já fechada não reiniciam checkout.
- `Purchase` usa a transição válida para confirmado e o ID do pedido. A rota legada reutiliza o recibo do ledger específico quando aceito ou informa pendência; esse fluxo não cai novamente no destino padrão antigo. Os demais produtos e rotas conservam a configuração anterior.
- fbp, fbc/fbclid quando existentes, IP/UA verificados, UTMs e IDs recebidos continuam associados à visita e ao pedido pelo contrato existente. Não se inventam parâmetros de anúncio ausentes.
- Falha/lentidão da mensuração não bloqueia o acesso ao WhatsApp após o formulário válido; o fallback existente de 900 ms foi preservado. Consentimento negado, DNT/GPC e QA não geram mensuração desta camada.

## Auditoria da Meta na sessão autenticada

Conta **1118807690580190**, proprietário Manuela Santos 1. O conjunto de dados **28298613626504767** tem acesso compartilhado com essa conta. O conjunto ativo **120253721988940392**, campanha C01-MICAEL_COM_IMAGEM-GERADA-FACEBOOK, usa local de conversão Site e evento Comprar. O anúncio **120253721988930392** aponta para a VSL autorizada e mostra explicitamente Pixel ID 28298613626504767 em Rastreamento. As configurações e o rascunho preexistente não foram publicados, descartados ou alterados.

O campo Parâmetros de URL está vazio. Isso explica a ausência de campaign_id/ad_id explícitos nos registros consultados; não autoriza inventá-los ou substituir fbclid. A preservação de parâmetros recebidos foi testada. O Gerenciador de Eventos foi filtrado para 16/11; PageView/ViewContent/CtaClick/Contact estavam presentes, sem checkout novo ou Purchase dessa data antes da correção. O alerta ativo era confirmação de domínios; não havia lista de permissão configurada. A política global compartilhada foi preservada, sem criar uma lista que pudesse excluir outros sites. Não foi gerado token novo nem ativada integração Meta paralela.

## Percurso e limite de perdas

No recorte de 2026-11-15T03:00:00.000Z a 2026-11-17T01:26:27.304Z: 2076 visitas medidas, 1450 IDs de navegador, 41 visitas com clique, 1 vínculo anterior comprovado. São registros/identificadores, não pessoas únicas garantidas. O ledger tinha quatro tipos de evento de página/clique aceitos, sem IC/Purchase no destino V213.

O gateway admitiu 131 IDs únicos; 3 não tiveram correspondência na consulta de mensagens. As três ocorrências são de 15/11, anteriores à versão atual; seus payloads não permitem reconstituição confiável. Não foram criadas mensagens ou replays para preencher a lacuna. Não se declarou ausência de perdas históricas.

Abrir WhatsApp não comprova pressionar Enviar. Por isso, subtrair cliques de contatos não mede clientes perdidos. O novo vínculo remove a lacuna técnica de correlação para entradas elegíveis, mas não garante 100% de entrega de redes/provedores nem de conclusão pelo usuário. O atendimento humano e os contatos existentes não foram liberados ou alterados para forçar testes.

## Testes executados e resultado

| Teste | Evidência |
|---|---|
| Guards senior e produto | PASS no candidato oficial isolado |
| Testes focados | 116/116 PASS |
| Suíte geral senior | PASS, 1778.7 s, exit 0; resumos TAP # tests 43, # pass 43, # fail 0, # tests 482, # pass 482, # fail 0, # tests 22, # pass 22, # fail 0 |
| Browser celular/desktop | 180 verificações PASS, larguras 375/430/1280, normal/QA/consentimento negado/falha/lentidão, rede interceptada |
| URL pública após publicação | Oito consultas HTTPS PASS, HTTP 200 para celular/desktop/script/painel; script confere com a fonte publicada |
| Verificação visual publicada | Formulário aberto e campos preenchidos em modo QA, sem submissão WhatsApp; captura formulario-publicado-v237.jpg |
| Mongo e modelos oficiais | Dois ciclos de checkout e recompra, dois Purchase, hooks save/updateOne/findOneAndUpdate, idempotência, conflito e scope guard PASS; autoridade simulada nessa prova |
| Aplicação HTTP completa | 28 verificações PASS, preload selado real, rede/mount isolados, Mongo/SQLite descartáveis, relógio nativo, respostas de ferramentas simuladas e provedor HTTP local |
| Primeira saudação no ensaio HTTP | 28.877 s; não é promessa de entrega futura sob fila |
| Funil HTTP até venda | Três frascos USD 95,99, resumo corrigido, uma venda confirmada e espelho confirmado no SQLite; repetição não duplica |
| Mensuração no funil HTTP | Quatro eventos de página/clique + um IC + um Purchase; destino único 28298613626504767, cookies/contexto do visitante preservados |
| Guardas negativos/startup | PASS; adulteração e flags legadas proibidas rejeitadas, legado somente leitura |
| Controlador | 33 verificações PASS, gates obrigatórios, integridade e preservação de rollback/flags |
| Preservação | 14 arquivos comerciais anteriores com os mesmos bytes; painel/Nginx/player/timing/preços/Dropi/Z-API/voz/convites preservados |
| Recuperação código/configuração | Antes e depois, envelopes criptografados recuperados em RAM, hashes/permissões/metadados e adulteração verificados; sem restauração em produção |
| Pós-venda preservado | Dry-run PASS após ativação, zero envios; timer e controles herdados mantidos |

Esses ensaios não enviaram mensagens reais, pedidos Dropi ou compras fictícias à Meta. A primeira versão V237-R1 foi substituída antes de publicação ao se identificar a lacuna do modelo central; sua suíte geral interrompida permanece registrada como FAIL/superseded. Somente R2 pode sustentar este aceite.

## Identidade publicada e congelamento

Backend: `/opt/vitalismen-automacao/releases/20261117T014141Z_production-20261117-73b1d1a`; commit `73b1d1a0933a9443f9fefd518ec392fc40dc1286`, tree `f69d1b191d28b9222cd6d31f2219685b91ac2435`. Fonte tag `production-20261117-73b1d1a`. Processo real PID 3728844, cwd resolvido, pm_cwd e pm_exec_path conferidos no release ativo. Health online e Z-API conectada. Um reinício direcionado somente do processo Vitalismen, conforme recibo de ativação.

Frontend: `/var/www/vitalismen-vitpower-2026g/assets/cta.js`; SHA-256 `dfe3c28174bccf6146af113d8c47cae3c4d423ce41af8c9bdd681857709051b6`, fonte `3fc8b51e3b2e87d9aef7cb3a0d6e97f358bd144d`. Substituição atômica com UID/GID/modo preservados, sem reiniciar Nginx. HTML mobile/desktop, player e chat conservaram seus hashes. O painel público continua no alias oficial anterior.

`STATUS_BACKUP_GLOBAL=FAIL` permanece: MongoDB standalone sem consistência global comprovada. O PASS desta entrega é de recuperação reversível de código/configuração, sem pausa de escritas, migração, mudança de topologia ou restauração de banco vivo.

## Rollback documentado — não executado

1. Restaurar atomicamente somente `169.58.51.100:/var/www/vitalismen-vitpower-2026g/assets/cta.js` a partir de `/var/backups/vitalismen-ec/journey-measurement-v237-r2/cta.before.js`, mantendo UID/GID/modo originais. Conferir SHA-256 `7f2e7408b6c44c40183ad4562d7f57a675d9966f57a9d5059664790828c8ed9e`.
2. Executar o controlador root `python3 -I -B -S /opt/vitalismen-automacao/backups/ec-journey-measurement-v237-r2-20261116/operations-controller.py rollback`. O controlador exige o asset público anterior, retorna ao pai V236, retira somente seu drop-in e mantém o ledger.
3. Validar symlink current, cwd real do PM2, pm_cwd, pm_exec_path, health e transporte oficial. Não restaurar banco sobre dados vivos, repetir compras, mensagens, convites ou pedidos Dropi. Os controles do pai e o seu timer permanecem registrados.

## Pendência física

O primeiro novo checkout e a primeira venda atribuída após esta publicação ainda devem ser observados no tráfego real e no conjunto correto. O teste de CAPI desta revisão foi simulado em rede isolada; os recibos reais de página anteriores e a configuração autenticada Meta são evidências distintas. Recebimento no Gerenciador de Eventos não garante, sozinho, atribuição a um anúncio específico. A auditoria não promete apagar alertas históricos ou reconstituir cookies ausentes das duas vendas anteriores.

Evidências: `C:\Users\Wolfe\Backups\VITALISMEN_EC\JOURNEY_META_V237_R2\20261116` e a pasta operacional `C:\Users\Wolfe\Documents\SITES\MAXLIENSHOP_JULHO_2026\Vitalismen Automacao\ops\candidates\journey-meta-v237-r2-20261116`. Nenhuma senha, token ou chave integra este relatório ou o Git.
