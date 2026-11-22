# Acesso ao rastreio Servientrega EC — auditoria de 22/11/2026

## Estado observado

- Origem oficial consultada: VPS Hostinger `72.60.137.77`, release ativa `20261121T172300Z_production-20261121-d6a815d`.
- Em `2026-11-22T15:55:27Z`, requisições GET pequenas a `https://www.servientrega.com.ec/`, `/Tracking` e `/Tracking/Masivo` retornaram HTTP 403 do destino `172.175.234.240`; a saída pública do VPS era `72.60.137.77`.
- A resposta HEAD de `/Tracking` em `2026-11-22T15:46:27Z` trouxe `Server: Microsoft-Azure-Application-Gateway/v2` e HTTP 403. A mesma rota também respondeu 403 nesta máquina. Isso não identifica a regra de bloqueio.
- `src/services/carrierTrackingService.js` usa Playwright na página pública `/Tracking/?guia=...&tipo=GUIA`; exige guia e estado visíveis e correspondência exata com a guia consultada. O histórico V139 confirma o uso desse caminho em 2026-09-07. Não há credencial de API Servientrega/SERVICLI nas chaves de ambiente consultadas, nem integração autenticada implementada.
- `src/services/postSaleDropiReadOnlyV210Service.js` consulta a conta oficial Dropi em modo somente leitura. O mapeamento atualmente usado preserva ID do pedido, telefone, produto, status e guia; não comprova horário e histórico do evento original da transportadora.
- `src/routes/webhook.js` possui um placeholder `/status-update` que responde sucesso sem autenticar a origem nem persistir status. Não é integração logística operacional.
- O timer V188 estava inativo na última verificação; não houve envio ao cliente nesta auditoria.

## Fontes possíveis e pendências

1. **Servientrega direta:** o site oficial anuncia solução E-Commerce e aponta ao sistema corporativo SERVICLI. É necessário obter do canal comercial/técnico oficial a confirmação de API ou webhook de rastreio, titularidade das guias, credenciais, documentação, ambiente de teste, limites e procedimento para resolver o 403. Nenhuma API foi comprovada no domínio oficial.
2. **Dropi como intermediária:** pedir à Dropi a proveniência de cada estado da Servientrega, com guia, status bruto, horário do evento e histórico. Estado agregado do pedido não equivale automaticamente a evento original da transportadora.
3. **Página pública:** só voltar a usá-la após HTTP 200 e validação por leitura de guia exata, estado, horário e parser atual. O rastreio em massa também retornou 403 e não é alternativa operacional no estado observado.

O domínio `servientregaapi.com` não teve vínculo com o domínio oficial da Servientrega comprovado; não enviar dados ou credenciais a ele.

O endereço `servicioalcliente@servientrega.com.ec` aparece nos Termos e Condições do domínio oficial. Em 22/11/2026, a solicitação técnica abaixo foi enviada a esse endereço pela conta autorizada `novocontodalua@gmail.com`; recibo Gmail `thread_id=1a2045242aec68e7`, rótulo `SENT`. O corpo não contém guias, dados de destinatários ou credenciais. Resposta técnica ainda pendente.

O endereço `comercial@dropi.co` consta no site oficial da Dropi Ecuador. Em 22/11/2026, foi enviada pela mesma conta uma solicitação de API ou webhook autorizado com guia, estado bruto, horário, histórico e proveniência dos eventos Servientrega, ou encaminhamento ao suporte técnico; recibo Gmail `thread_id=1a20453bdc2f3d89`, rótulo `SENT`. Nenhum dado de pedido, guia ou cliente foi incluído. Resposta técnica pendente.

## Solicitação técnica preparada para Servientrega

> Somos a operação Vitalismen Ecuador. Nossos pedidos são enviados pela conta Dropi e possuem guias Servientrega. As consultas HTTPS às páginas oficiais de rastreio retornam HTTP 403 a partir de `72.60.137.77` e também de outra rede. Pedimos identificação do canal autorizado para consultar o estado das guias de forma periódica e sem automação da interface pública. Existe API ou webhook empresarial de rastreio para guias originadas pela Dropi? Quem deve solicitar o acesso: a loja ou a Dropi como titular do contrato? Precisamos de documentação de autenticação, ambiente de teste, limites de consulta, formato de guia, estado bruto, horário do movimento e histórico, além de orientação para o bloqueio 403. Não solicitamos alteração de pedidos nem de status.

## Critérios antes de ativar avisos

- Confirmar a autorização da fonte e obter resposta para duas guias reais: uma em trânsito e outra em estado final, sem enviar mensagens.
- Associar pedido Dropi, guia Servientrega, telefone/produto e evento externo por correspondência exata; rejeitar ambiguidade e divergência.
- Persistir fonte, horário da consulta, horário do movimento e estado bruto. Rejeitar resposta sem guia observada, estado explícito ou origem verificável.
- Executar testes isolados, validação selada no VPS, dry-run e um ciclo controlado. Manter ledger de envio único e travas de atendimento humano.
- Estado final vindo apenas da Dropi permanece insuficiente para avisos de entrega/devolução enquanto não houver prova inequívoca da transportadora.

Nenhuma integração, flag, timer ou pedido foi alterado nesta auditoria. Nenhuma mensagem foi enviada a clientes.

## Tentativa de liberação controlada em 22/11/2026

- A candidata local `3851f18b` passou em 11 testes isolados de vínculo exato da guia, leitura Dropi recente, deduplicação, canário V188 e rejeição do HTTP 403. Os dois testes de integração V188/V194 não iniciaram no Windows porque importam um módulo selado instalado apenas no VPS; não foram considerados aprovados.
- Na origem oficial, o timer V188 continuou `inactive`, o overlay protegido estava presente e o contador de executores mutantes ativos era zero. O `dry-run` real do executor falhou antes de consultar pedidos: o runtime selado esperava SHA-256 `a5a374227dc21b9241f487cb4ef9f04f4eb88207eb71fde55616b552d123913f` de `public/qr.html`, enquanto o arquivo íntegro no commit ativo tinha `f61686c080cf1c5d3e07c3d2edd8600049356422af5e7612b0d9c7c12a02cb08`. `git status -- public/qr.html` não mostrou modificação de trabalho; a divergência é entre release e manifesto selado, não uma edição feita nesta auditoria.
- A busca de respostas das solicitações técnicas não encontrou retorno da Servientrega ou da Dropi. A fonte pública Servientrega segue sem prova de acesso autorizado; não houve validação de duas guias reais.
- Resultado: publicação, ativação do timer e teste real de envio **não executados**. Corrigir a cadeia selada por sucessor validado e repetir o `dry-run` são pré-requisitos, além de comprovar a fonte e cada guia antes de qualquer mensagem.

## Causa da incompatibilidade de runtime

- `ops/post-sale-v188` fixa `NODE_OPTIONS` em `ec-runtime-successor-v195-context.mjs` para `snapshot`, `dry-run`, `run` e staging. Esse contexto herda o hash antigo de `public/qr.html` e falha antes de importar o executor no release atual.
- O PM2 do bot ativo usa `scripts/lib/sealed-successor-preload-v1.mjs`. Um teste de integração V188/V194 apenas com esse preload também falhou: sem a autoridade operacional própria, a cadeia exige `VITALISMEN_STRICT_READ_ONLY=true`, `SAFE_OBSERVATION_POLICY=STRICT_READ_ONLY` e schedulers desligados. O overlay V188 é um perfil separado que autoriza escritas delimitadas; não se deve apresentá-lo como QA de leitura nem reutilizar a identidade do PM2.
- Portanto, a correção exige um sucessor selado específico para o executor V188, com registro de autoridade e hashes do release atual, que reconheça exatamente o perfil V188 e a candidata de pós-venda. Depois, o launcher e o staging devem apontar para esse sucessor e passar os testes autenticados. Trocar somente `NODE_OPTIONS`, editar o manifesto antigo ou desligar o guard não é uma liberação válida.
- Existe no VPS um executor separado `postsale-sealed-run-v2.py` e preload `postsale-sealed-preload-v2.mjs`, com autorização root `postsale-sealed-production-v2.json` em modo `0400`. Ele valida um release exato de outubro (`20261024T033527Z_production-20261024-0b5ae37`) e um commit/árvore fixos; não aceita o release ativo de novembro nem a candidata atual. A autorização antiga não pode ser reaproveitada ou reescrita como se fosse da release nova.
- Nova checagem confirmou `vitalismen-postsale-full-v188.timer=inactive` e `vitalismen-postsale-transactional-v116.timer=inactive`; `current` permanece no release `20261121T172300Z_production-20261121-d6a815d`. Nenhum executor de envio foi ativado.

## Rechecagem do executor ativo em 22/11/2026

- A checagem acima dos timers estava incompleta: `vitalismen-postsale-full-v203.timer` está **ativo** e executa `vitalismen-postsale-full-v203.service` a cada 15 minutos. O ciclo concluído às 19:09:13 UTC registrou `PASS_BATCH`, `sendCount=0` e `physicalOutboundCount=0`. V188 e V116 permanecem inativos. Não ligar um segundo timer.
- A candidata V263 no commit `14f90e13e3ec0036dd66f308adf9d81c483436e8` passou em 13 testes isolados e em um dry-run sem o preload operacional: houve um pedido selecionado e zero envios. Esses resultados não autorizam produção.
- O dry-run autenticado com a nova autoridade isolada parou antes da consulta de pedidos com `REPURCHASE_UNREGISTERED_LAUNCHER`. A política V256 exige `process.argv[1]` sob o release ativo registrado; o script candidato em `/opt/vitalismen-automacao/candidates/postsale-v263-c4458b2` não satisfaz esse contrato. A autoridade V263 criada separadamente não amplia a lista de launchers da V256. Não alterar `process.argv`, desligar flags, sobrepor módulos nem editar o release ativo para contornar a trava.
- Um sucessor válido precisa registrar o commit, árvore, payload e perfis no encadeamento oficial e ter um launcher de pós-venda autorizado pelo guard ativo. Só após o dry-run autenticado selecionar candidato com guia e estado Dropi recentes, interromper o V203 e executar um único ciclo real, conferir recibo Z-API e ledger e provar ausência de reenvio. O PM2 do bot continua online no release `d6a815d`; não houve troca de controlador nem mensagem enviada pela V263.
