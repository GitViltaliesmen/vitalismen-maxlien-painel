PROJECT=VITALISMEN_EC — VITALISMEN OFICIAL

# Tex Ultra Ecuador — mensuração V243 publicada — 17/11/2026

Correção autorizada pelo operador para `https://plusmen.shop/tex`: identificação Tex Ultra Ecuador, Lead somente após contato confirmado e vínculo da origem do anúncio. Inclui manutenção isolada das dependências do serviço Meta e reconciliação exata do baseline compartilhado na origem169.58.51.100. Não inclui ativação de campanha ou alteração de orçamento.

## Comportamento

PageView, ViewContent e InitiateCheckout existentes foram conservados, com identificação Tex somente no caminho autorizado. Abrir página, clicar ou preencher nome não cria Lead. A referência anônima TX243 conserva a origem disponível, inclusive fbp/fbc e parâmetros de anúncio admitidos, sem transmitir corpo, telefone ou nome do formulário pela nova mensuração. O contato exige inbound oficial persistido na sessão/contato corretos; o chat usa o vínculo V242 já confirmado. Primeiro canal e primeiro contexto permanecem estáveis entre navegadores e reinícios.

Lead browser/CAPI compartilha event_id. A tentativa fica persistida antes do transporte; resposta desconhecida ou rejeitada não provoca reenvio automático. Purchase exige pedido Tex novo, confirmado e explicitamente vinculado à origem V243; pedidos antigos não são reenviados. Uma troca manual para outro produto mantém o transporte desse produto. Nenhum pedido é criado pelo mecanismo de mensuração.

O funil Tex, a sequência única aprovada, primeiro nome e voz Ana Lopez continuam na implementação anterior. Celular continua com VSL; desktop/iPad continuam com a página informativa. Player `6aafe87d665f0c5b457748ad`, botão `preco_89`, CTA2257s, Turbo1.2x e `whatsapp.js` original foram preservados. O destino nativo é `553171862958`; a sessão oficial usa o identificador canônico já existente `5531971862958`. Não se acrescentou dígito por suposição. O número15991418416 é histórico deste fluxo.

## Fontes oficiais

Backend `/opt/vitalismen-automacao/releases/20261117T231233Z_production-20261117-d27cc7c`, commit `d27cc7c7f2a21ad74e02ca5b6332ee50b151399b`, parent real `d35d58c5a74fb4314d7c3548e614501453ab3ed6`. PM2 PID3896107, cwd/exec via `/opt/vitalismen-automacao/current` e cwd real conferidos. A atualização concorrente B01/preços/perguntas está preservada. Doze arquivos constituem a microcamada funcional.

Assets/origem/controllers: commit `7298c09c7d2c2ba219aabf7145e7742cb2993e2f`, pasta `ops/publications/tex-measurement-v243/`. Origem `/opt/cloaker`, somente processo `cloaker`, PID1314328, Node22.23.5 em sidecar `.runtime`; Node global20.20.2 preservado. Dezenove arquivos de código/configuração de dependências da origem são versionados. A política zero vulnerabilidades permanece integral. O SDK WhatsApp mantém a versão anterior. Os snapshots selados do runtime são armazenados por bytes Base64+SHA para não normalizar finais de linha da fonte congelada.

Página: três arquivos existentes mudam — duas referências no HTML, uma referência opaca opcional no chat e duas rotas exatas no Nginx. Dois assets versionados são novos. Congelamentos originais permanecem imutáveis; o filho `docs/freeze/plusmen-tex-measurement-v243-20261117.json` inverte somente deltas fixos e conferidos. O teste negativo rejeitou alteração de telefone mesmo quando seu novo hash foi declarado.

## Validação real executada e limites

`npm run senior:check` completo retornou0; contagem TAP agregada: 547 testes, 547 passes, 0 falhas, 0 pulados. Trinta e oito testes focados Tex, regressões de webchat e regressões herdadas B01/perguntas foram conferidos. Na origem,100/100 testes e três guards passaram; dependências com zero vulnerabilidades. Frontend13, integração HTTP7, controlador backend28 e controlador origem7 passaram. Os relatórios guardam comandos, hashes e limites de cada ensaio.

HTTP/armazenamento/inbound/Meta dos ensaios funcionais usaram namespaces privados e fixtures identificadas. A execução R4 foi interrompida sem publicação após o novo teste reproduzir o bloqueio indevido de Purchase Tex pela barreira genérica. R5 encaminha somente a capacidade Tex explicitamente autorizada antes dessa barreira; os outros produtos mantêm o bloqueio original. A suíte completa foi executada novamente para o candidato final, sem retirar testes ou travas. Candidatos anteriores não publicados e falhas de infraestrutura não foram promovidos a PASS.

A primeira tentativa de publicação da origem foi bloqueada porque o controlador comparava a resposta interna de3002/tex com o HTML público servido pelo Nginx. O código/configuração/dependências anteriores foram restaurados e seus hashes conferidos; a página pública permaneceu com o hash aprovado. A verificação foi corrigida para exigir separadamente os dois hashes, com sete testes incluindo alterações negativas em cada camada. A fonte do controlador é sucessora da publicação inicial, preservada no Git; nenhum guard foi desligado e o backend funcional aprovado não mudou. A ocorrência e a restauração ficam na evidência ORIGIN_PUBLICATION_ATTEMPT1, com pass=false para a tentativa inicial.

Após publicação: oito combinações dispositivo/rota, hashes dos assets/painel, chat público e recusa de entrada sem identidade, prova privada HMAC inválida403 e assinatura válida com referência inválida400, player/CTA/Turbo e playlist HLS conferidos. Nenhuma referência válida de teste foi criada em produção para simular conversão. Configuração registrada da capacidade nova e entrada pública herdada conferidas por perfil, estado, prova e API pública. Uma sonda adicional com `node -e` foi recusada por não ser um launcher registrado; essa recusa foi preservada e nenhum guard foi alterado. Não se alega inspeção direta das variáveis do processo em produção. Health online, Z-API conectada, fila0 e pós-venda dry-run com zero envios; timer aponta para o controller do release atual. O guard completo da página passou em produção.

Duas sondas iniciais com User-Agent padrão do Python foram bloqueadas pelo Cloudflare, inclusive erro1010 antes da aplicação na prova privada. O painel foi conferido com User-Agent de navegador; a prova entre servidores foi repetida com o User-Agent node usado pelo transporte fetch. O par final403/400 veio da validação esperada, sem alterar regras do Cloudflare, assinatura, chave, origem ou guard. As tentativas iniciais permanecem registradas como pass=false.

O pós-venda em dry-run teve zero envios; três guias Vit Power foram classificadas como bloqueadas por canary_v75_configuration_invalid. Esses casos de outro produto ficaram preservados e não foram liberados por esta correção Tex Ultra. Não se afirma aprovação funcional irrestrita de todas as tarefas de pós-venda.

No Gerenciador Meta aberto: conta1088255310505694, negócio1104902089381854, conjunto1100892582698669 com plusmen.shop listado. PageView/ViewContent/InitiateCheckout tinham atividade; Lead não foi observado. As cinco campanhas consultadas estavam desativadas. A API não dispõe de ads_read. A inspeção posterior pela interface confirmou a campanha Tex52540540369345 desativada, anúncio52540540369745 apontando para `https://plusmen.shop/tex`, conjunto52540540369545 com inclusão Equador, pixel selecionado por nome `MANUELA_SANTOS_LATAM_CO` e evento Comprar. O identificador numérico do pixel não foi exibido diretamente no conjunto;1100892582698669 foi observado anteriormente no Gerenciador de Eventos. A Meta avisou ausência de atividade da conversão escolhida em nenhum momento ou há mais de14dias. O campo WhatsApp do anúncio usa a Página do Facebook e não exibiu número; o telefone privado de login do Facebook não foi confirmado. Não foram editados campos nem clicados Salvar/Publicar. Não foi criada allowlist nem alterado orçamento.

A aceitação de um Lead/Purchase novo real e a jornada anúncio→VSL→bot ainda dependem de tráfego real posterior. Os testes não garantem entrega de anúncios, conversão comercial ou atribuição final pela Meta. Não houve mensagem WhatsApp, pedido, Dropi ou evento Meta sintético provocado por esta revisão, nem observação física integral do vídeo em aparelho.

## Espaço e preservação dos logs

O disco bloqueou o preparo por falta da reserva mínima. Um log antigo de saída fechado, de39MB, foi compactado com comparação completa da descompactação e metadados. O log antigo de erro fechado deaproximadamente37GB foi transferido por gzip e envelope AES-256-GCM+RSA-OAEP ao diretório de backup cifrado no Windows. A recuperação independente autenticou o envelope, os bytes comprimidos, todos os bytes do log original e a rejeição de adulteração, sem gravar conteúdo em claro localmente. Só depois dessa prova o original fechado foi arquivado fora do VPS, liberando espaço. Os arquivos de log atuais `out-0.log`/`error-0.log`, PM2 e MongoDB não foram alterados por essa manutenção. Manifesto, localização do arquivo cifrado e metadados para recuperação ficaram registrados no backup e na evidência final.

O indicador global de Meta Purchase continua bloqueado por desenho do sistema congelado. A microcamada Tex usa sua capacidade própria, limitada à origem e à confirmação oficial, antes da barreira genérica. O teste negativo confirma que os demais produtos continuam sob a regra anterior.

## Recuperação

Backend/gates/controller: `/opt/vitalismen-automacao/backups/tex-meta-attribution-v243-r5-20261117`. Estado: `/var/lib/vitalismen-deploy/ec-tex-measurement-v243-r5`. Origem/gates/controller: `/root/tex-meta-attribution-v243-20261117-r5/production-backup`. Cópia cifrada independente: `C:\Users\Wolfe\Backups\VITALISMEN_EC\TEX_MEASUREMENT_V243_R5\20261117`. Código/configuração antes e depois tiveram descriptografia em memória, hash, metadados e adulteração conferidos. Chave privada não foi enviada ao servidor. Isto não equivale a backup global MongoDB.

Rollback compatível: executar `operations-controller.py rollback-feature` no backend e `origin-controller.py rollback-feature` na origem, após conferir hashes e mudanças posteriores. Conservar dependências seguras, código compatível e journals `/var/lib/vitalismen-tex-measurement-v243`, `/var/lib/vitalismen-tex-linked-entry-v242` e `/opt/cloaker/private/meta/tex-measurement-v243`. Depois da publicação da página/coorte, retorno ao código anterior é bloqueado. Não apagar memória, resetar contatos, repetir tentativas ou restaurar MongoDB.

Evidência: `docs/evidence/tex-ultra-measurement-v243-20261117.json`. Próximo passo comercial: veiculação autorizada pelo operador e conferência do primeiro contato/pedido real, sem fabricar conversões de teste.
