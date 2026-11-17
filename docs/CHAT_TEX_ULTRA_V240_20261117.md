PROJECT=VITALISMEN_EC — VITALISMEN OFICIAL

# Tex Ultra Ecuador — chat do site e voz Ana Lopez V240 publicados

Estado: PUBLIC_VERIFIED, 17/11/2026. Este registro substitui o estado de candidata R6 anteriormente descrito neste arquivo. A microcamada solicitada está publicada. A aprovação visual anterior do operador continua limitada à VSL celular/página informativa desktop; não se atribui uma nova aprovação visual ao chat.

## Comportamento entregue

O popup existente `dashboardFloatingChatV224` / `webChatDashboardDialogV222` do painel oficial acompanha também as conversas Tex Ultra de https://plusmen.shop/tex. A origem é identificada no servidor e persistida separadamente do atendimento. A lista do popup mostra Tex Ultra e permite busca pelo produto; não foi criado outro painel. Os dois ajustes estáticos do painel são somente o rótulo e o campo de busca dessas conversas.

Na VSL celular, o visitante abre manualmente “Habla con Ana · Tex Ultra”, abaixo do vídeo. O chat não abre sozinho nem inicia áudio ao carregar. Ana é apresentada como assistente virtual. “Escuchar a Ana” oferece a voz aprovada, ID `qHkrJuifPpn95wK3rm2A`, modelo `eleven_multilingual_v2`, espanhol, com credencial dedicada já existente. Há texto disponível, cache e limites de concorrência; fechar/sair interrompe o áudio. Não há gravação de microfone ou clonagem nesta mudança.

O funil próprio acolhe, responde dúvidas antes de avançar, aceita escolha explícita de 1/2/3/6 frascos e consulta o catálogo Tex Ultra: USD 35.99 / 70.00 / 80.99 / 147.99. Pergunta de preço não seleciona quantidade. Mantém a quantidade já comprovada, evita repetir a pergunta final e respeita pedido humano/opt-out. Se a fonte comercial estiver indisponível, explica e encaminha ao humano. A continuação usa somente a CTA nativa quando ela já estiver disponível: o chat pode rolar até ela, sem antecipar, clicar ou substituir seu destino. Esta camada não registra pedido, não cobra, não envia WhatsApp, não consulta pedido privado Tex e não associa uma sessão anônima a um telefone por suposição.

Sessões Tex usam cookie `__Host-texchat-v240`, Secure/HttpOnly/SameSite=Lax, com identidade exigida pelo proxy privado. O corpo da requisição não escolhe produto. Isolamento entre sessões/produtos, idempotência, capacidade global, mutex e limites existentes foram preservados. Vit Power continua com seus padrões anteriores.

## Fontes oficiais publicadas

- Backend: `72.60.137.77:/opt/vitalismen-automacao/current` → `/opt/vitalismen-automacao/releases/20261117T162142Z_production-20261117-30ca9d6`.
- Commit backend `30ca9d6f77788186ada1ca7ab2a8cd0962f773b9`, tree `b8125c0b27c7e186d2b32e10c923af0e4a553c80`, branch `codex/tex-ultra-web-chat-v240-20261117-r7`, tag `production-20261117-30ca9d6` no Git oficial. A branch production não foi movida.
- Backend pai preservado: release `20261117T121338Z_production-20261117-cf79efd`, commit `cf79efded4cc5242800946728d589a186cfa349f`.
- Painel servido: `/var/www/vitalismen-panel-phonefix-20261108-r1/qr.html`, SHA anterior `20bbb94813330913f642a6e14069ad023df66e4e54e01850965508c6c9b58ec6`, publicado `f31fe4278a1901c2670868e262a0128bf8d2074c0b752fbe24ca0dca6f93adca`.
- Assets: `169.58.51.100:/var/www/plusmen-tex-vsl-v1/assets/chat-tex-ultra.{js,css}`. Fonte estática final `f5cfea93acbc00c4600122114c9d6b7be1801784`, branch `codex/tex-ultra-web-assets-v240-20261117-r7` no Git oficial.
- Includes novos: `/etc/nginx/snippets/plusmen-tex-chat-{proxy,inject}-v240.conf`. O proxy usa o IPv4 oficial `72.60.137.77`, Host/SNI `ec.maxlien.shop`, certificado verificado e sem retry automático. Credencial do proxy permanece privada, root-only, fora do Git.
- Runtime externo: `/usr/local/lib/vitalismen-deploy/ec-tex-ultra-web-chat-{profile,sealed}-v240-r7.mjs`; estado `/var/lib/vitalismen-deploy/ec-tex-ultra-web-chat-v240-r7`.
- Manifesto público: `docs/freeze/plusmen-tex-chat-v240-publication-20261117.json`; evidência resumida: `docs/evidence/tex-ultra-web-chat-v240-20261117.json`; artefatos detalhados: `ops/candidates/tex-ultra-web-chat-20261117-r7/`.

Às 16:58 UTC, PM2 PID 3796748 online, `pm_cwd=/opt/vitalismen-automacao/current`, `pm_exec_path=/opt/vitalismen-automacao/current/src/index.js` e `/proc/PID/cwd` no release R7. Z-API conectada. Estado Tex ACTIVE/PUBLIC_SITE com prova privada vinculada por hash. Serviço pós-venda permanece no release atual, dry-run PASS_DRY_RUN, sendCount=0, physicalOutboundCount=0.

## Preservação e testes efetivos

O manifesto original `docs/freeze/plusmen-tex-device-split-20261117.json` permanece byte a byte inalterado. O guard compara os seis arquivos originais descontando somente os dois includes exatos autorizados e confere hashes/metadados dos quatro novos arquivos. PASS em produção após publicação. HTML fonte, whatsapp.js, desktop informativo, player `6aafe87d665f0c5b457748ad`, CTA `preco_89` em 2257s/37:37, Turbo 1.2x e destino `553171862958` permanecem preservados. Não houve salvamento no VTurb. WhatsApp principal, outros produtos, B01/pausas, pedidos, Dropi, Meta/CAPI, preços, dados históricos e flags operacionais herdadas não foram alterados pelo chat.

- Suíte completa da candidata de negócio C1/R6: 547 testes PASS, 0 falhas/skip, 2414,1s; grupos 43/43 + 482/482 + 22/22. Prova original vinculada por hash. A equivalência R7 comprova fontes de negócio e testes byte idênticos; as diferenças finais são import do verificador PM2 e dois caminhos registrados do preload/runtime. Não se declara reexecução integral da suíte em R7.
- R7 executou novamente senior guard e guard de produto, 16/16 testes Tex e 66/66 de regressão web, sem skip. Controle de ativação: oito casos blackbox PASS com verificador selado real e provedor PM2 simulado em namespaces privados, incluindo sucesso e recusa de processo/ambiente/current/payload/versão/identidade incorretos. Nenhum restart de produção nesses ensaios.
- DOM: quatro casos PASS, incluindo abertura manual, voz opcional, CTA oculta, dupla submissão/falha incerta e retorno BFCache sem repetir mensagem ou resposta interrompida. Nginx isolado: 18 verificações PASS; controlador: 12 negativas/preservação PASS.
- QA privado via proxy real: nove verificações PASS, modelo real, quatro preços/ingredientes oficiais, separação de cookies/histórico, recusa de troca de produto pelo corpo e de áudio de outra sessão, quantidade 2 e encaminhamento explícito sem pedido. Áudio Ana real com 83.634 bytes, validado por ffprobe e decodificação integral FFmpeg. As sessões anônimas próprias foram limpas.
- Prova pública: 13 verificações PASS, incluindo oito casos de dispositivo/caminho, três assets com SHA exato, painel e API sem cabeçalho QA. Desktop/iPad mantêm página informativa; Android/iPhone recebem VSL e chat. Sessão de disponibilidade limpa sem mensagem/modelo/voz/pedido.
- A comparação pública reconhece somente a linha exata do beacon Cloudflare preexistente; não remove scripts arbitrários. HTML desktop também foi comparado pelo mesmo cliente, antes/depois. Analytics permanece habilitado.
- Nenhum envio WhatsApp, pedido real, evento Meta ou operação Dropi foi criado por estes ensaios. Não houve nova instância Mongo, migração ou instalação de dependências.

## Recuperação e rollback exclusivo

Backup oficial R7: `72.60.137.77:/opt/vitalismen-automacao/backups/tex-ultra-web-chat-v240-r7-20261117`. Backup da origem: `169.58.51.100:/root/plusmen-tex-chat-backups/20261117-v240-r7`. Cópias cifradas antes/depois no Windows: `C:/Users/Wolfe/Backups/VITALISMEN_EC/TEX_WEB_CHAT_V240_R7/20261117`.

A recuperação foi verificada em memória: 13 arquivos/metadados anteriores, 39 posteriores no backend e 20 na origem; configuração privada posterior com projeto/PM2/baseEnv presentes; hashes e rejeição de adulteração PASS. Nenhum plaintext privado foi gravado localmente e a chave privada não foi enviada à VPS. Isso comprova recuperabilidade de código/configuração, não uma restauração em produção nem backup global MongoDB. A margem de disco observada continua baixa, cerca de 550 MB; nenhuma limpeza de outro escopo foi feita.

Rollback somente se solicitado ou diante de falha que o justifique: executar primeiro, como root na origem, `python3 /root/plusmen-tex-chat-backups/20261117-v240-r7/site-controller.py rollback`; depois, na VPS EC, `python3 /opt/vitalismen-automacao/backups/tex-ultra-web-chat-v240-r7-20261117/panel-controller.py rollback`; por último `python3 /opt/vitalismen-automacao/backups/tex-ultra-web-chat-v240-r7-20261117/operations-controller.py rollback`. Os controladores exigem hashes/estado esperados, removem somente a microcamada e restauram o release pai/configuração operacional herdada. Conferir health, Z-API, PM2 cwd/execPath/proc e os arquivos nativos. Não restaurar banco vivo, resetar contatos ou repetir mensagens. A restauração final não foi acionada para teste, pois desligaria o chat publicado.

## Ocorrências e limites registrados

R1 teve conflito local no cálculo das opções e fixture UTF-8; R2 revelou formatador herdado restrito a Vit Power; R3/R4 ajustaram identidade/guards, R5/R6 preservaram finais de linha. Essas falhas não foram ocultadas. A candidata C1/R6 passou na suíte completa, mas sua ativação foi recusada por `SEALED_PURPOSE_INVALID`: o helper ainda importava o verificador anterior V239. Nenhum novo processo R6 foi ativado; o controlador restaurou e reiniciou uma vez o pai. R7 corrigiu exclusivamente o import/caminhos necessários, passou nos oito casos blackbox e foi ativada com um restart do processo alvo.

A repetição adicional da suíte do pai foi interrompida e registrada `SUPERSEDED_NOT_A_PASS`, reutilizando a prova integral já vinculada ao pai exato. A primeira chamada da suíte candidata usava launcher npm recusado antes de testes; foi corrigida para o caminho canônico permitido, sem desligar guards. O QA negativo inicial recebeu 423 do guard global em vez do 403 esperado; a prova registra a recusa sem cookie e a validação aceita somente os códigos/bodies específicos. Não se converteu falha em aprovação genérica.

Durante a conferência HTTP, o beacon Cloudflare gerou diferença entre clientes. A inclusão móvel foi temporariamente suspensa e restaurada para obter baseline do mesmo cliente; os fontes nativos não foram alterados. Um probe público posterior retornou 504 por tentativa IPv6 sem conectividade na origem. O proxy foi corrigido para o IPv4 da mesma VPS oficial, mantendo TLS validado e sem retry; os recibos anteriores foram preservados e o manifesto final contém o hash atual. Os 13 checks públicos passaram após essa correção. A cópia privada do ambiente usada no ensaio PM2 isolado foi removida pontualmente depois da prova.

Não foi observada inspeção visual/audição em celular físico, nem reprodução contínua de 37 minutos até a CTA. A validade/decodificação do MP3 não substitui ouvir o áudio no aparelho. A correção de identificação Meta anteriormente preparada continua separada e não foi publicada nesta tarefa.
