PROJECT=VITALISMEN_EC — VITALISMEN OFICIAL

# Saudação e perguntas agrupadas Vit Power — V228

ESTADO_ATUAL: PUBLICADO E ATIVO R6, COM AGRUPAMENTO QA_ONLY. Fonte e tag publicadas; ativação em 16/11/2026 às08:31:15.549Z, PID3617629. Saudação Hola integrada ao B01 e correção de origem Vit Power preservadas. A espera agrupada de60s ainda está restrita ao8637; EC_FORWARD_ONLY depende da prova física. Essa prova não foi substituída por simulação.

## Comportamento solicitado

Uma nova entrada autenticada da CTA atual conserva Vit Power, envia um texto inicial com Hola/nome/horário do Equador e mantém o bloco B01 existente quando o cliente não responde. Se houver resposta, a guarda de nova entrada interrompe as mídias seguintes. Mensagens rápidas ficam agrupadas por contato até completar60 segundos sem nova mensagem; o bot responde às perguntas na ordem recebida em uma única saída. Novo texto reinicia a janela; callback duplicado não a estende.

A escolha manual do operador, humano/opt-out, pedidos existentes, demais produtos, preços, checkout, Dropi, Meta/CAPI e VSL mantêm os contratos anteriores. Não há reset em lote, replay do incidente nem envio de teste para cliente real.

## Fonte oficial e escopo

- Parent publicado: V227 `7db0a30bf7397c768294f626b555b2d3c99fee34` em `/opt/vitalismen-automacao/current` na VPS72.60.137.77.
- Candidato: `cb776711a0fe172c408dd642215e444580f6a40d`, tree `dbd0edef425eff0eb40882903d6555d9f50524e6`.
- Release preparado: `/opt/vitalismen-automacao/releases/20261116T080433Z_production-20261116-cb77671`.
- Autoridade root: `/usr/local/lib/vitalismen-deploy/ec-vitpower-burst-{profile,sealed}-v228-r6.mjs`; estado `/var/lib/vitalismen-deploy/ec-vitpower-burst-v228-r6`.
-13 caminhos selados; nova fila tipada `ContactState.vitPowerBurstV228`, dois serviços pequenos e17 testes. Motor, roteador e transporte existentes reutilizados; nenhuma infraestrutura nova.
- A ativação inicial é QA_ONLY. Promoção EC_FORWARD_ONLY exige entradas físicas autenticadas do8637, uma resposta agrupada, tempo mínimo60s, recibo persistido e ACK de entrega. O controlador não fabrica esse comprovante.

## Publicação e auditoria ativa

Branch `codex/ec-vitpower-burst-v228-r6-20261116`; tag `production-20261116-cb77671`. Branch production preservada. PM2 confirmado com cwd e executável via current, e cwd real no release cb77671. Treze hashes, flags/perfis, datas herdadas, Z-API conectada e health online conferidos. Frontend e Nginx idênticos. Pós-venda dry-run PASS, zero envios; timer e data forward-only original preservados.

A primeira chamada de ativação abortou antes da troca do release porque o invocador não fornecia HOME/PM2_HOME. O PM2 abriu um namespace vazio em `/etc/.pm2`; zero aplicações foram iniciadas ali. Esse daemon vazio foi encerrado e a ausência do processo confirmada. O invocador passou a usar explicitamente `/root/.pm2`; o processo oficial só reiniciou uma vez, na ativação válida. O serviço de pós-venda usa SetLoginEnvironment=no; seu próprio drop-in V228 recebeu HOME=/root e PM2_HOME=/root/.pm2 explícitos. A leitura do PM2 com esse ambiente efetivo encontrou o mesmo processo oficial, sem restart do serviço/timer e sem envio. Backup e hashes antes/depois em SYSTEMD_BOOT_ENVIRONMENT.json. Evidência `ACTIVATION_ATTEMPT1_PM2_ENV.json` no backup root, além dos logs da tentativa. O erro não foi apresentado como PASS.

## Persistência e prevenção de repetição

Fila e geração por contato, CAS, IDs efetivos do provedor, trava com prazo, histórico e journal do SDR. O worker recebe autoridade somente para o contato e entradas persistidas daquela trava. Antes de enviar, revalida geração e vínculo entre os textos originais e a mensagem agrupada. Nova pergunta durante o processamento adia o envio e conserva o lote; tomada humana antes de qualquer tentativa bloqueia e descarta somente os IDs pendentes daquela fila, conservando histórico e dedupe. Após liberação explícita do operador, uma nova entrada pode iniciar outro lote, sem replay do lote bloqueado; envio incerto ou worker interrompido durante uma tentativa não autoriza retry automático. O histórico é consultado antes de reenviar; recibo existente é reconciliado.

O atraso de60s é um período mínimo de silêncio, não uma promessa de entrega no segundo exato. Disponibilidade do provedor/modelo, fila e intervenção humana continuam sendo condições operacionais.

## Auditoria do candidato R6

-252 testes focados PASS; senior guard e produto PASS. Suite senior completa R6:547 PASS (43+482+22), zero falhas,1.188,5 segundos. A suite geral R5 foi interrompida exclusivamente por ter sido substituída pela correção de retomada humana R6; não se apresenta como PASS geral.
-33 verificações com aplicação HTTP real, Mongo descartável e provedor local: PASS; CTA → produto/owner → Hola → perguntas em ordem → uma resposta → fila concluída.
-31 verificações com perguntas recebidas antes da saudação: PASS.
-32 verificações com reinicialização do processo enquanto a fila aguarda: PASS, uma única resposta após retomada.
-34 verificações com tomada humana, cancelamento do lote sem envio e novo lote após liberação explícita: PASS. Nenhuma pergunta do lote bloqueado foi reenviada.
-16 verificações da função real de restrição de escrita: PASS, rejeitando outro contato, mensagens de outro telefone e autoridade indevida de claim/finalização.
-Adulteração de fonte/preload, flags proibidas, startup privado e senior readonly do legado: PASS. Cinco verificações do controlador PASS.
-Testes HTTP usam namespace isolado, banco descartável, provedor local e resposta de modelo simulada. Zero gravação em banco comercial, WhatsApp, pedido, Dropi ou Meta. A API real do modelo foi exercitada separadamente no parent V227, com o mesmo núcleo funcional; isso não é apresentado como novo teste físico da V228.
-Frontend e Nginx iguais ao baseline; HTTP público200 no Windows. A chamada Python da própria VPS recebeu403 da Cloudflare, limitação preservada no relatório. Diferença pública de HTML limitada ao beacon Cloudflare existente. Suite browser115 herdada, sem alegar nova execução.
-Revisões anteriores R1–R5 foram preservadas e nunca ativadas. A revisão R6 também corrige o bloqueio permanente que poderia ocorrer após o operador liberar o atendimento humano. Incluem ajustes reais de autorização da fila, envelope da sessão e saudação, além de falhas das fixtures de codificação, tempo de startup e handle de processo do teste de reinicialização. Nada foi convertido artificialmente em PASS.

## Backup e rollback

Código/configuração anterior em `C:/Users/Wolfe/Backups/VITALISMEN_EC/VITPOWER_BURST_V228_R6/20261116`: BOOT_COMPLETE_BEFORE_V228.vbe com20 arquivos/metadados e RUNTIME_CONFIG.vbe. Descriptografia/leitura em memória, SHA256, UID/GID/modos e rejeição de adulteração PASS. Chave privada não enviada; plaintext não gravado. Parent preservado.

Controlador: `/opt/vitalismen-automacao/backups/ec-vitpower-burst-v228-r6-20261116/operations-controller.py`. Se V228 estiver ativa, `python3 -I -B -S <controlador> rollback` retorna ao V227, desabilita a capacidade nova, restaura o perfil de boot e o drop-in anterior do pós-venda e verifica PM2/health. Não restaura banco nem repete mensagens, pedidos ou eventos. Não usar rollback V227 enquanto este sucessor estiver ativo.

Backup global MongoDB: FAIL. Nenhuma migração, restauração ou pausa de escritas em produção. A recuperação de código/configuração não equivale a backup completo de dados.

## Limite da liberação e próxima prova

A janela QA de08:31:40 a08:36:40Z terminou com zero entradas novas do8637, zero lote e zero resposta nova. Em08:38Z o comando contain restaurou o hold anterior; o contato de teste, suas etiquetas e histórico foram preservados, com zero pedidos. A espera de60 segundos continua QA_ONLY e não está liberada para todos os clientes. O atendimento EC previamente aprovado continua ativo.

Não há prova física nova para a V228. Quando o operador estiver com o celular8637, abrir a segunda janela finita com `qa_window.py arm qa-window-2`, receber a assinatura QA atual e duas perguntas separadas. Conferir os callbacks autenticados e a resposta única após60s, seu ledger, memória/modelo e ACK>=2. Somente então `promote.py` pode ampliar o agrupamento para EC_FORWARD_ONLY; não exige nova publicação/restart e não aceita simulação como prova física. Nunca enviar como se fosse uma entrada real a partir da conta do atendimento.

## Evidências

`ops/candidates/vitpower-burst-v228-r6-20261116/`: STAGED, REGISTERED, QUALIFICATION, HTTP_TEST, HTTP_FAST_TEST, HTTP_RESTART_TEST, HTTP_HUMAN_TEST, SCOPE_TEST, EXTRA_QUALIFICATION, OPERATIONS_TEST, PUBLIC_BASELINE, BROWSER_TEST, recibos PUBLISH/ACTIVATE, POST_SALE_DRY_RUN e LIVE_AUDIT_QA_ONLY. Artefatos privados e credenciais ficam fora do Git.
