PROJECT=VITALISMEN_EC — VITALISMEN OFICIAL

# Preço sem interrogação e percurso até fechamento — V239-R2

Publicado e auditado em UTC 2026-11-17T12:54:12.217944+00:00. Pedido do operador: investigar dois atendimentos que pareciam parar depois do frasco, responder às perguntas e continuar pelos dados faltantes, resumo, confirmação e agradecimento. Fonte inspecionada primeiro: `/opt/vitalismen-automacao/releases/20261117T035331Z_production-20261117-5b35e78`, commit `5b35e7856bf908263db2fa557508c7370814328a`.

## Diagnóstico e mudança mínima

A V219 exigia interrogação ou palavras interrogativas antes de classificar perguntas comerciais. “Precio”, “Los precios..” e “Porfavor me indicas la promoción..” ficavam fora do renderizador determinístico de preços. O modelo podia anexar outra pergunta de quantidade; a proteção histórica a recusava. O log oficial do final 9125 confirmou LOG_SEND_BLOCKED / history_repeat / ask_quantity; a causa não foi inferida somente da imagem. Reproduzidos sete cenários falhos no baseline (49/56), incluindo o pedido de promoção após uma pergunta de quantidade já enviada. A correção reconhece pedidos curtos de preço/oferta e solicitações explícitas sem pontuação, usando as fontes e a resposta ordenada existentes. Agradecimentos e confirmações de oferta, quantidade isolada e formulários estruturados não ganham intenção nova de consulta.

Nenhuma trava antirrepetição, lock, histórico, controle humano ou recibo foi desligado. Nenhum replay ou retry automático foi acrescentado. O preço continua vindo de getEcuadorOffer/catálogo normal, sem inventar desconto, estoque ou garantia. O cliente escolhe a quantidade; a pergunta de preço não registra compra.

Somente cinco arquivos do release mudaram: dois ponteiros de boot, classificador freeflowQuestionPriorityV219Service, teste novo e contrato com lista permitida. 25 arquivos comerciais foram conferidos contra o parent real, incluindo motor, B01/pausas, fila de 60 s, finalizador/agradecimento, recompra, humano/STOP, Dropi, Z-API, Order, mensuração e chat. VSL/CTA/painel e seus sete arquivos públicos permaneceram iguais. Não há alteração de configuração Nginx, preços, credenciais ou banco.

## Casos reais observados — somente leitura

No final 9125, a solicitação de promoção/preços não terminou com recibo e o lote ficou em revisão. Posteriormente o operador enviou preços manualmente e manteve o contato em atendimento humano. Esse estado e os IDs históricos foram preservados. A correção não libera esse contato nem repete sua mensagem antiga; a retomada exige revisão individual do lote em estado incerto e liberação pelo operador, sem replay automático.

No final 6691, o banco contém um turno do agente, memória, ledger sent e ACK 2 para preços cerca de 64 segundos após “Precio”. A aparência da bolha, sozinha, não foi usada como prova de automação; o relato de envio manual do operador permaneceu registrado como divergência. Esse contato não foi usado como destinatário de teste nem recebeu repetição. Não se declarou que todos os clientes tiveram o mesmo defeito.

Os recortes com dados de clientes permanecem privados fora do commit de auditoria. Não foram enviados dados reais ao modelo durante os ensaios.

## Testes e evidências

| Verificação | Resultado |
|---|---|
| Reprodução baseline | 49/56; sete falhas reproduzidas, preservadas |
| Candidato final focado | # tests 105, # pass 105, # fail 0; 108.1 s |
| Senior completo | # tests 43, # pass 43, # fail 0, # tests 482, # pass 482, # fail 0, # tests 22, # pass 22, # fail 0; 2041.6 s; exit 0 |
| Senior/produto, adulteração, flags e startup selado | PASS; legado /root/wa_wpp somente leitura |
| Controlador de publicação/rollback | 30 verificações PASS, incluindo bloqueio por prova faltante/adulterada |
| HTTP real isolado | 26 verificações PASS; aplicação, MongoDB e espelho SQLite descartáveis |
| B01 e tempo | Saudação em 17.612 s; quatro mídias até o frasco e pausas originais preservadas |
| Pedido de preço sem interrogação | Respondido com valores oficiais, sem repetir quantidade e sem mudar para humano |
| Dados e confirmação | Quantidade/cidade, nome/modalidade, província/endereço, correção e novo resumo; nenhum pedido antes de confirmar |
| Fechamento | Exatamente um pedido sintético confirmado, 3 frascos/USD 95,99, espelho confirmado e agradecimento pelo finalizador existente |
| Duplicidade/isolamento | Confirmação repetida não duplica; QA sem pedido; outro contato sem venda antecipada; zero Dropi/Meta real |
| Recuperação antes/depois | Criptografia, descriptografia em RAM, SHA-256, UID/GID/modos e rejeição de adulteração PASS |
| Produção/publicação | PM2 real no release novo, health online, Z-API conectada, timer e datas herdadas preservados; URLs públicas verificadas |

O modelo e o provedor do ensaio HTTP são simulados; o roteador, os guards, o relógio (60 segundos reais), a persistência e o finalizador são os reais, em namespaces isolados. O MongoDB descartável usa tmpfs limitado, cache de 0,25 GB, reserva de RAM e core dump desabilitado. Não houve instância de teste usando o disco do MongoDB comercial. Não se apresenta a simulação como venda física, recebimento de Meta ou envio WhatsApp real.

A R1 não foi publicada: a preparação Windows havia convertido UTF-8 por leitura cp1252. A qualificação isolada foi interrompida, marcada FAIL e preservada. A R2 reconstruiu os arquivos com UTF-8 explícito, verificou que os textos comerciais herdados permanecem idênticos e passou os gates novamente. Nenhum teste falho foi ocultado ou convertido em PASS.

## Publicação, congelamento e rollback

Backend `cf79efded4cc5242800946728d589a186cfa349f`, tree `1d05d5c8b63a39118c3e656e42e9311648e04927`, release `/opt/vitalismen-automacao/releases/20261117T121338Z_production-20261117-cf79efd`, tag `production-20261117-cf79efd`. PM2 PID 3765163, pm_cwd `/opt/vitalismen-automacao/current`, pm_exec_path `/opt/vitalismen-automacao/current/src/index.js`, cwd real `/opt/vitalismen-automacao/releases/20261117T121338Z_production-20261117-cf79efd`. Um reinício direcionado do processo Vitalismen, condicionado à fila e ao chat ociosos; sem reiniciar Nginx ou MongoDB.

Backups opacos e evidências em `C:\Users\Wolfe\Backups\VITALISMEN_EC\PRICE_CLOSURE_V239_R2\20261117`; registros root em `/opt/vitalismen-automacao/backups/ec-price-closure-v239-r2-20261117`. O parent V238 e seus commits permanecem disponíveis. Rollback exclusivo, documentado e não executado: `python3 -I -B -S /opt/vitalismen-automacao/backups/ec-price-closure-v239-r2-20261117/operations-controller.py rollback`. Retorna ao parent V238 com seu perfil, retira somente o drop-in V239, confere o processo real e a saúde. Não restaura banco sobre dados vivos e não repete mensagens, pedidos ou eventos.

## Limites

Novas solicitações elegíveis usam o comportamento corrigido. Atendimento humano continua soberano; nenhum contato foi resetado ou liberado em lote. Primeira interação orgânica e primeira venda real após a correção continuam pendentes de observação, distintas da simulação. Pedidos exigem dados válidos, resumo e confirmação do cliente.

O backup global MongoDB permanece FAIL; recuperação de código/configuração não equivale a backup consistente de todos os dados. A leitura final encontrou aproximadamente 629 MB livres na VPS. A capacidade de disco continua baixa e deve ser tratada separadamente antes de ampliar a carga; nenhum plano de hospedagem ou outra aplicação foi alterado nesta entrega.
