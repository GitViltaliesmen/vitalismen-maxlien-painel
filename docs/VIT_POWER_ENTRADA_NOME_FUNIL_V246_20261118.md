PROJECT=VITALISMEN_EC — VITALISMEN OFICIAL

# Entrada e apresentação automática Vit Power — V246 R5

Pedido explícito: “Respondeu print, mas preciso que siga o funil como acertamos”. A microcamada foi publicada em 2026-11-18T18:24:43.099177+00:00, commit `1b356e351210d9bf52fae7c1db9a7dcb9e9015fa`, tree `7716d88ff14aaded258f4d9cdbca8a37e52841fb`, parent `d8c8b0dd697e712bf2d7442ae90cb6aa6576fcc8`, release `/opt/vitalismen-automacao/releases/20261118T170557Z_production-20261118-1b356e3`. A separação por produto solicitada foi preservada.

## Falha física observada

A entrada real do 8637 em 18/11/2026 às 16:26:41 UTC foi aceita pela autorização nativa. Saiu somente uma resposta de preço aproximadamente 65 segundos depois, com recibo de entrega; não houve B01. O registro continua FAIL para o funil completo. A autorização foi contida pela CLI nativa e o hold anterior restaurado, sem replay ou envio manual.

Na integração também foi comprovado que a classificação pública rejeitava a CTA achatada com nome: o contato equatoriano ficava sem produto e ia para revisão. Essa validação agora reconhece somente o texto publicado com formatação equivalente, mantendo perguntas e outros produtos fora dessa exceção. A atualização Tex Ultra d8c8b0d publicada durante a auditoria foi incorporada como parent real; suas mudanças de admissão e convites permanecem intactas. Dois outros fatos foram reproduzidos: o nome terminal na mesma linha da CTA impedia o reconhecimento genérico e a captura do primeiro nome; o agrupador anterior ao B01 também exigia um marcador de VSL que essa entrada não tinha. Na preparação do QA, o “Hola” recebido fora da janela havia sido mantido como primeira entrada, contribuindo para esse desvio. A correção não cria atribuição de visita por inferência de texto.

## Comportamento publicado

O parser aceita um campo terminal Nome/Nombre válido após uma entrada genérica conhecida, com ou sem quebras de linha. Perguntas específicas, dados de pedido, quantidade, confirmação e outros produtos não passam a ser entradas genéricas por essa regra.

Antes do agrupamento, a nova classificação permite a saudação B01 para a primeira mensagem genérica comprovada do Vit Power. EC normal exige uma única entrada persistida da sessão oficial e texto inicial correspondente. O 8637 exige a prova nativa de uma autorização inicial válida para o mesmo ID de mensagem; um campo enviado pelo cliente não concede essa permissão. Histórico de apresentação, locks, dedupe, limite temporal, resultado incerto e proteções posteriores permanecem ativos.

Sequência preservada: saudação em 5–30 segundos conforme fila, um áudio do período em America/Guayaquil, prova social aprovada, frasco Vit Power e tabela de 1/2/3/6 frascos, USD 39.99/70.00/95.99/167.99. Perguntas interrompem a apresentação e seguem a espera de 60 segundos de silêncio já aprovada. O pedido depende de confirmação explícita e dos dados exigidos.

Tex Ultra conserva handler, catálogo, mídias, origem e memória próprios; Nitrix conserva seu tratamento exclusivo e encaminhamento humano protegido. Painel, VSL/CTA, WhatsApp, Meta, Dropi, voz, demais preços, pós-venda e dados de clientes reais não foram alterados. Foram conferidos 35 arquivos comerciais protegidos e sete arquivos da página.

## Provas e limites

- Focados: # tests 429; # pass 429; # fail 0.
- Senior completo: # tests 43; # pass 43; # fail 0; # tests 482; # pass 482; # fail 0; # tests 22; # pass 22; # fail 0.
- HTTP nativo: 60 verificações em Mongo real e SQLite descartáveis, sem rede externa, com modelo/provedor simulados. A entrada testada foi a CTA em uma linha com Nome/Nombre terminal.
- Duas rodadas completas do QA preservaram os ledgers anteriores, com cinco saídas cada, um áudio e tabela final; callbacks duplicados não repetiram apresentação.
- Venda fictícia de três frascos/USD 95.99 confirmada uma vez, refletida no painel e seguida de agradecimento. Zero mensagens físicas, pedidos Dropi ou eventos Meta gerados pelo ensaio.
- Preparação de reinício do QA: dez cenários no Mongo privado executaram o bloco exato de manutenção. Só a rodada ociosa com uma resposta comprovada é elegível; tentativa iniciada, pendência, incerteza, humano incorreto, concorrência ou recibo não confirmado foram rejeitados. Contato permanente, todos os ledgers e contatos alheios foram preservados.
- Doze índices reais reproduzidos, quinze duplicações rejeitadas; SHA da especificação projetada: `2e8f3aae690c10cdba6121cee579f888061e8747fb401fc6409c5eb473fdf145`. A metadata bruta foi retida; v/ns/background não integram a projeção usada no ensaio, e as chaves e demais opções foram comparadas integralmente.
- Controles adicionais: 12; controlador: 42; integridade, inicialização, links e mensuração Tex herdados passaram.
- Produção: PID 3970878, cwd/exec PM2 corretos, health online e Z-API conectada. Configurações e datas operacionais herdadas preservadas; timer existente mantido.
- Recuperação opaca de código/configuração antes e depois: hash, leitura/descriptografia em RAM, metadados e rejeição de adulteração PASS. Arquivos novos têm ausência de preimage registrada. Nenhuma restauração de produção foi executada. Isso não equivale a backup global MongoDB, que permanece FAIL.

## Tentativas retidas

A candidata R1 b86ec13 foi barrada pelo HTTP antes de publicação: corrigir somente o parser não resolvia a classificação anterior ao agrupamento. Foram encerrados apenas os processos privados e seu stage owner. Seu código e FAIL permanecem arquivados.

As falhas de preparação também foram preservadas: harness herdado esperava oito deltas em vez dos cinco do R1; teste de controlador citava o predecessor D27 em vez do R8; comparação inicial de índices incluiu a metadata background omitida pela projeção antiga; um helper negativo procurava a prova de herança antes de seu upload, passando depois a comparar o arquivo imutável do predecessor real. No R2, a primeira captura tentou ler preimage de um arquivo novo; o envelope falho foi retido e a ausência foi documentada antes da nova captura. O primeiro senior guard do R2 atingiu 120 segundos durante probes paralelos; o mesmo candidato e os mesmos limites foram reexecutados depois, mantendo o FAIL original. No R5, a conferência anterior à ativação também detectou um verificador apontando ao diretório R2. Ao selecionar os artefatos R5, o leitor estrito rejeitou entradas duplicadas no pacote de boot; o pacote foi preservado e uma nova cópia com caminhos únicos foi criada e validada sem aceitar hardlinks ou relaxar o leitor. No R5, a conexão SSH de acompanhamento caiu durante o senior completo; o driver e o processo isolado continuaram vivos. O recibo final veio da execução no servidor, preservando os códigos de saída, logs e a falha de transporte. Nenhum teste foi reiniciado por esse motivo. Nenhum guard, histórico ou dedupe foi desligado para obter PASS.

## Rollback e encerramento

Evidências: `C:\Users\Wolfe\Backups\VITALISMEN_EC\B01_NAMED_ENTRY_V246_R5\20261118`. Root: `/opt/vitalismen-automacao/backups/vitpower-named-entry-v246-r5-20261118`. Rollback pontual, documentado e não executado: `python3 -I -B -S /opt/vitalismen-automacao/backups/vitpower-named-entry-v246-r5-20261118/operations-controller.py rollback`. Retorna ao parent Tex Ultra d8c8b0d, preserva dados vivos, remove somente o drop-in desta microcamada e confere PM2/health. Não repete mensagens, pedidos ou eventos.

Uma nova entrada física após esta publicação continua PENDING. O novo teste só será aberto após a preparação segura do 8637; as evidências operacionais posteriores ficam em ops/observations/qa-named-entry-v246-r5-fresh-20261118. Não transformar a simulação nem o preço entregue na rodada anterior em PASS físico do novo funil.
