PROJECT=VITALISMEN_EC — VITALISMEN OFICIAL

# Acesso ao pedido sem digitar código e chat na metade da VSL — V238-R4

Publicação UTC 2026-11-17T04:33:30.476081+00:00. Escopo autorizado: simplificar a consulta privada, abrir automaticamente para o cliente identificado, impedir popup no início e abrir após **50% da VSL**, sem cobrir o vídeo, com novo acionamento chat + WhatsApp e preservação do botão WhatsApp anterior.

## Cliente e segurança

O cliente recebe um link privado no WhatsApp registrado no pedido EC Vit Power e reconhecido pela sessão oficial. Não precisa informar ID, gerar ou copiar código. Ao tocar, uma página mínima do próprio domínio, sem Pixel/analytics nem recursos de terceiros, remove imediatamente o fragmento da barra e resgata a permissão pelo proxy oficial. O cookie continua Secure/HttpOnly. O link vale 24 horas e fica vinculado ao primeiro navegador.

O chat abre o estado registrado e permite Atualizar mi pedido sem código. Cada leitura confere novamente país, produto e titular; expiração ou mudança de titular revogam o acesso. A resposta contém somente estado e data, sem endereço, dados de saúde ou identidade desnecessários. Trata-se do último estado salvo, com horário de Ecuador; não comprova uma nova consulta ao transportador. Dropi não foi modificado.

Abrir o chat ou informar um telefone não libera pedido. O visitante anônimo conversa normalmente, mas a consulta privada exige o link recebido no WhatsApp cadastrado. Não compartilhar esse link. O mecanismo não foi apresentado como OTP ou identificação civil. Limpar o histórico encerra a sessão; novo acesso poderá exigir novo link.

## Operador e convites

O formulário com ID, telefone, checkbox e Gerar código privado saiu do popup. Na conversa WhatsApp selecionada há **Preparar acesso seguro ao pedido**. A API exige Bearer válido, usuário ativo e administrador; encontra o pedido do telefone oficial e prepara mensagem para esse mesmo destinatário. O operador revisa e clica em Enviar pelo fluxo existente. Mudança de contato/credencial durante a preparação não transfere o link para outra conversa.

Nos convites automáticos já aprovados, clientes elegíveis com pedido recebem o link. Mantidos prova de entrada oficial, EC, titularidade exata, STOP, atendimento humano, bloqueios, janela 08–19 Ecuador, intervalo de dez minutos, locks e reserva/attempt anterior ao envio. O histórico reconhece a nova mensagem/URL em CHAT_ORDER e CHAT_ACCESS, além do ledger. Convites antigos não foram repetidos, nenhum disparo novo em massa foi iniciado e a campanha do parceiro manteve suas regras.

O WhatsApp transporta o link completo ao titular. O espelho/histórico remove o bearer; o setter de Message protege também os demais escritores desse padrão exato. Nenhum token real está no Git ou neste relatório.

## Chat e VSL

A abertura por oito segundos de página foi retirada. A automática depende de `video:timeupdate` e currentTime/duration >= 0,5, excluindo SmartAutoPlay, pausa, página oculta e fullscreen. Fechar impede nova abertura automática nessa carga. Desktop sem VSL não dispara por relógio. Não foram editados player, pitch, Turbo ou temporização da oferta.

No celular com VSL, o chat fica no fluxo abaixo do player, sem modal/backdrop sobre o vídeo. O novo **Chat + WhatsApp** abre o chat e o formulário no fluxo da página; após revisar/confirmar o contato, abre WhatsApp em outra aba e preserva a VSL na original. Se a aba for bloqueada, oferece continuação explícita. A abertura automática em 50% não abre WhatsApp nem envia mensagem.

O WhatsApp anterior conserva formulário, telefone, consentimento, atribuição e fallback. A mensuração V237 e o destino Meta permanecem preservados; consultar pedido não cria Purchase. Contrato do player consultado: [eventos oficiais VTurb](https://docs.vturb.com/en/docs/reference/player/api/events), [propriedades](https://docs.vturb.com/en/docs/reference/player/api/properties). A camada apenas observa o player.

## Testes

| Prova | Resultado |
|---|---|
| Guards senior/produto | PASS |
| Focados | # tests 93, # pass 93, # fail 0; 112.9 s |
| Senior completo | # tests 43, # pass 43, # fail 0, # tests 482, # pass 482, # fail 0, # tests 22, # pass 22, # fail 0; 1774.0 s; exit 0 |
| Novo browser | 57 verificações PASS; 375/430/1280; rede interceptada |
| WhatsApp anterior | 180 verificações PASS: normal, QA, consentimento negado, falha e lentidão |
| HTTP/JWT/Mongo/sessão | 24 verificações PASS com preload selado e proxy reais em aliases privados; banco/arquivos descartáveis |
| Negativos | Sem Bearer, não admin, QA, outro navegador, replay, telefone declarado, expiração e mudança de titular recusados |
| Anti-repetição | Ledger e histórico Mongo testados, inclusive sem ledger; dry-run não emite/envia; humano/STOP preservados |
| Controlador | 33 verificações PASS; gates por hash e rollback |
| Preservação | 18 arquivos comerciais intactos, incluindo mensuração, Order, funil, transporte e Dropi |
| Publicação | Processo real no release novo, health online, Z-API conectada, URLs/hashes conferidos, Nginx do dashboard intacto; duas rotas estáticas novas no site |
| Recuperação | Antes/depois: descriptografia em RAM, SHA-256, UID/GID/modos e adulteração verificados |

Sem WhatsApp real de teste, compra real, evento Meta fictício ou pedido Dropi. R1 foi rejeitado por geração do import de boot; R2 foi substituído ao revisar o reconhecimento da URL no histórico, com suíte geral interrompida somente no grupo isolado. Suas falhas/superseded permanecem registradas. R3 foi substituído antes de publicação para reforçar a separação de projetos, sem alterar produção. Somente R4 sustenta este aceite.

## Identidade publicada e rollback

Backend `/opt/vitalismen-automacao/releases/20261117T035331Z_production-20261117-5b35e78`, commit `5b35e7856bf908263db2fa557508c7370814328a`, tree `d3763c83df365d33142af7c079c949b55a9fa812`; tag `production-20261117-5b35e78`. PM2 PID 3744732; pm_cwd `/opt/vitalismen-automacao/current`, pm_exec_path `/opt/vitalismen-automacao/current/src/index.js`, cwd real `/opt/vitalismen-automacao/releases/20261117T035331Z_production-20261117-5b35e78`. Um reinício direcionado do processo Vitalismen; sem reiniciar Nginx.

Frontend/painel fonte `35073c424e95bcfac2621da09f4dea2caa0806f1`: `169.58.51.100:/var/www/vitalismen-vitpower-2026g/assets/` — cta.js, chat-v220.js, chat-v220.css e os dois assets acesso-pedido. Painel `72.60.137.77:/var/www/vitalismen-panel-phonefix-20261108-r1/qr.html`. HTML mobile/desktop e players intactos. Os dois assets novos foram copiados antes da ativação. A primeira conferência pública detectou 404 porque faltavam os seus dois locations exatos no Nginx; isso foi corrigido às 04:30 UTC, validando nginx -t e recarregando sem reinício. O cache negativo temporário expirou. A página privada recebeu Cache-Control no-store, no-transform para impedir a injeção automática do beacon Cloudflare; os hashes públicos passaram integralmente depois. Os demais blocos do Nginx do site foram preservados byte a byte. A mensuração nas demais páginas permanece intacta. Referência: [documentação Cloudflare sobre injeção](https://developers.cloudflare.com/web-analytics/get-started/).

Backups: `/var/backups/vitalismen-ec/order-access-v238-r4/`, `/opt/vitalismen-automacao/backups/ec-order-access-v238-r4-20261117/panel.before.html` e envelopes/manifestos em `C:\Users\Wolfe\Backups\VITALISMEN_EC\ORDER_ACCESS_V238_R4\20261117`. Rollback documentado, não executado: restaurar atomicamente os três assets anteriores e o painel, usando hashes/metadados do manifesto; retirar/desativar somente os dois assets novos após conferir seus hashes; executar `python3 -I -B -S /opt/vitalismen-automacao/backups/ec-order-access-v238-r4-20261117/operations-controller.py rollback`. Restaurar também /etc/nginx/sites-available/taviazen.shop usando nginx-site.before.conf, UID/GID/modo registrados em NGINX_LANDING_ROUTES.json, validar nginx -t e recarregar graciosamente. O controlador exige frontend/painel anteriores, retorna ao pai V237 e remove somente seu drop-in. Não restaurar banco vivo ou repetir convites, mensagens, compras ou Dropi.

## Incidente durante os ensaios

O MongoDB de produção encerrou em 17/11/2026 às 03:53:59 UTC após falha na gravação dos logs. A execução concorrente dos bancos descartáveis, quando a VPS já tinha pouca margem de disco, é compatível com esgotamento temporário de espaço. O trabalho **não foi apresentado como livre de interrupção**. O serviço existente foi iniciado novamente, com a mesma configuração, sem restauração/migração de dados. Health HTTP 200, Z-API conectada e saídas desbloqueadas foram confirmados às 04:05:21 UTC. Esses horários correspondem a 00:53:59–01:05:21 em São Paulo; o instante final é a confirmação de saúde, não a duração exata do boot.

A auditoria somente leitura do gateway nesse intervalo encontrou zero entradas reais admitidas e zero admissões sem correspondência. Houve uma rejeição RECIPIENT_NOT_ADMITTED; não se afirmou com isso ausência absoluta de perda fora do escopo observado. Não foram feitos replays ou envios para compensar o incidente. Três árvores de candidatos nunca publicados foram removidas após preservar commits, bytes alterados, metadados e recuperação opaca; releases aprovados e dados foram mantidos. Um log rotacionado fechado foi compactado localmente, com leitura integral e SHA-256 conferido, sem apagar histórico. A margem passou para aproximadamente 606 MB, ainda baixa. Nenhum log privado foi exportado ou incluído no Git.

Os testes Mongo foram concluídos em série, com cache limitado e sem core dump. Os seus executores agora exigem pelo menos 2 GB livres antes de iniciar outra instância descartável. A regressão restante teve prioridade de CPU/I/O reduzida somente no grupo isolado. A capacidade de disco continua um ponto operacional a tratar separadamente; não foi ampliada a hospedagem ou alterada configuração global para esconder essa limitação.

## Limites

Primeiro uso legítimo do link e primeira abertura orgânica aos 50% da VSL móvel após a publicação permanecem verificações físicas separadas. Os ensaios não foram apresentados como entrega real. A interface publicada foi inspecionada, mas não foi fabricado tráfego, mensagem ou compra para simular sucesso em produção.

`STATUS_BACKUP_GLOBAL=FAIL` permanece pela ausência de consistência global comprovada do MongoDB standalone. PASS de recuperação refere-se somente a código/configuração reversível, sem pausa de escritas, migração, mudança de topologia ou restauração de banco em produção.
