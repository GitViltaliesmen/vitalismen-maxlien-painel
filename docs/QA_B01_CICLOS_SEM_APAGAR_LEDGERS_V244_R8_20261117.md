PROJECT=VITALISMEN_EC — VITALISMEN OFICIAL

# Reinício controlado do QA 8637 — V244 R8

Publicado em 2026-11-18T02:06:07.308051+00:00; parent `d27cc7c7f2a21ad74e02ca5b6332ee50b151399b`; commit `322c98a652c71d9a9714a523d83e91093bbbfe18`; tree `1e0bebc4483e56faa41531082e1897bec3d8acd4`; release `/opt/vitalismen-automacao/releases/20261118T010247Z_production-20261118-322c98a`.

## Falha física e causa

A entrada real do 8637 foi recebida em 17/11/2026 às 22:10:20 UTC, com nome Gerson. O B01 parou antes do primeiro envio por `attempt_already_reserved`. Nenhuma das cinco etapas foi tentada nesse ciclo. Os cinco comprovantes de um teste anterior continuavam protegidos. As chaves por telefone/etapa e o índice composto único telefone/tipo/fingerprint impediam um novo ciclo, mesmo após limpar a memória conversacional. O número foi contido pelo comando nativo; a mensagem antiga não foi reproduzida nem enviada manualmente como se fosse resposta automática.

## Alteração mínima

Somente o telefone permanente de QA 5515998038637 recebe chave e fingerprint específicos do ID da autorização nativa de teste. Esse ID vem da elegibilidade persistida no servidor e é gravado em campo opcional do schema B01. O ID fornecido pelo cliente é ignorado. O dispatcher exige a mesma autorização ainda válida. Limites de janela, entradas, humano, lock, histórico e dedupe permanecem.

Para EC, as chaves de tentativa, fingerprints e a chave semântica da saudação são idênticas ao parent. Somente a tabela final ganha chave semântica própria de etapa, pois compartilhava o contexto da saudação e era rejeitada como repetida com os índices reais. A chave da tabela é estável por etapa; todas as proteções continuam ativas. Não há migração ou preenchimento automático do novo campo. Um mesmo permit continua proibido de reenviar a mesma etapa. Novo permit só funciona após reset explícito do QA; a atualização não reinicia trabalhos. Todos os ledgers anteriores são preservados.

B01 mantém saudação textual em 5–30 segundos conforme fila, um áudio por período de America/Guayaquil, prova social existente, frasco e tabela oficial de 1/2/3/6 frascos, USD 39.99/70.00/95.99/167.99. Perguntas interrompem a apresentação e são agrupadas após 60 segundos de silêncio. Preços, produto, confirmação, agradecimento, demais produtos, VSL, painel, WhatsApp, Dropi e mensuração foram preservados.

## Validação auditada

- Testes focados: # tests 387; # pass 387; # fail 0.
- Senior completo: # tests 43; # pass 43; # fail 0; # tests 482; # pass 482; # fail 0; # tests 22; # pass 22; # fail 0; exit 0.
- HTTP nativo: 60 verificações; MongoDB real em tmpfs, SQLite descartável, relógio real e namespace sem rede externa.
- Dois novos permits completam cinco etapas cada, com exatamente um áudio e tabela final; todos os documentos de dedupe anteriores permanecem iguais.
- Limpeza de QA: oito cenários em MongoDB isolado executaram o escopo Mongo extraído do script real de manutenção; dry-run e limpeza do zero-attempt passaram, tentativa iniciada, resultado incerto, trabalho pendente, modo humano incorreto, concorrência e ledger incerto foram rejeitados; demais contatos/mensagens e ledgers preservados.
- Os 12 índices reais da coleção de produção foram reproduzidos no Mongo privado; SHA da definição: 2e8f3aae690c10cdba6121cee579f888061e8747fb401fc6409c5eb473fdf145.
- Prova específica do índice: cinco registros legados preservados; duas rodadas independentes; quinze duplicações rejeitadas; chaves EC originais iguais.
- Perguntas preço/composição respondidas na ordem, pedido simulado de três frascos/USD 95.99 confirmado uma vez e agradecimento posterior.
- Tex Ultra: teste HTTP herdado sem alteração, em ambiente privado próprio; integridade e provas vinculadas por SHA.
- Gates adicionais: 12; controlador: 42; arquivos comerciais protegidos: 34.
- Recuperação opaca de código/configuração antes/depois: decrypt em RAM, metadados e rejeição de adulteração PASS. Não é backup Mongo global.
- Produção: PID 3910112, PM2 cwd/exec corretos, timer preservado e Z-API conectada; VSL e painel conferidos.

Modelo de IA e provedor de WhatsApp são simulados no ensaio HTTP. Nenhum envio real, Dropi ou Meta foi gerado por essa simulação. Nova entrada física depois desta publicação permanece pendente; a entrada física anterior demonstra a falha, não comprova esta correção.

## Tentativas rejeitadas e integração concorrente

R1 não publicado: schema estrito descartava o ID do permit. R2 não publicado: fingerprint antigo ainda colidia no índice composto; um guard teve timeout de 100 segundos e passou em execução com limite de 180 segundos, mantendo o FAIL original. R3 não publicado: a chave semântica da saudação ainda era compartilhada; o HTTP bloqueou corretamente. R4 foi cancelado antes de executar por uma referência de constante detectada na revisão. R5 completou duas rodadas QA mas revelou a colisão semântica entre saudação e tabela no EC; não foi publicado. R6 separa somente a chave semântica da tabela EC; para QA, vincula a chave semântica de cada etapa ao permit nativo e reproduz os índices reais antes de iniciar a aplicação privada. O preparo Git inicialmente não tinha a fronteira shallow do repositório de objetos; fsck rejeitou e foi repetido após copiar somente essa metadata verificada. Commit e fontes funcionais não mudaram. A verificação de recuperação local foi iniciada cedo demais em paralelo com a captura; repetida após a captura completa, passou. O primeiro lote focado do R6 atingiu o limite de 900 segundos após 358 casos aprovados, sem conclusão de TAP. O mesmo candidato e a mesma lista foram reexecutados com limite de 1800 segundos; o resultado inicial permaneceu arquivado. Nenhuma trava foi desligada para obter PASS.

Candidatos cancelados, suas falhas e registros permanecem arquivados. Nos candidatos cancelados R1/R3/R4 foram removidas somente entradas duplicadas de dependências com identidade de inode comprovada e dois caches de index reconstituíveis por Git, após prova de árvore retida; fontes, segredos criptografados, objetos e evidências ficaram preservados. O preparo R3 usa objetos Git alternativos, sem copiar packs, e mantém a reserva mínima original de 400 MiB mais duas vezes o orçamento medido. Não houve limpeza de produção.

R6 completou 373 testes focados, 547 no senior e 60 no HTTP; a qualificação final foi FAIL porque outro deploy Tex mudou a produção para d27cc7c durante a execução. R6 não foi publicado. A reconstrução sobre d27cc7c começou no R7; o cenário privado inicialmente herdou flags públicas de medição/convites e foi corrigido para desarmá-las somente no ambiente isolado, preservando as asserções; dois FAILs iniciais ficaram arquivados. R7 foi rejeitado antes de publicar porque a validação inversa do Tex consultava os hashes da microcamada em lugar do delta Tex herdado. R8 vincula esse mapa aos hashes imutáveis do parent d27cc7c, mantendo as verificações inversas e o comprovante original. O nome inicial do drop-in não venceria o novo parent; o guard impediu e foi aumentado de 80 para 88 caracteres z antes da publicação, sem editar o parent. O controlador passou novamente nas 42 verificações; a microcamada B01/modelo foi verificada sem sobreposição e todos os arquivos novos Tex foram preservados. A prova original Tex permanece com seu commit de origem e SHA, vinculada ao sucessor sem reescrever o comprovante.

## Publicação, recuperação e limites

Branch/tag próprios; index local e branch production preservados. Ativação com fila/locks/B01/lotes ociosos e mutex, reinício direcionado somente Vitalismen. Sem reinício de Nginx ou MongoDB.

Evidências: `C:\Users\Wolfe\Backups\VITALISMEN_EC\QA_B01_CYCLE_V244_R8\20261117`; root `/opt/vitalismen-automacao/backups/qa-b01-cycle-v244-r8-20261117`.
Rollback documentado, não executado: `python3 -I -B -S /opt/vitalismen-automacao/backups/qa-b01-cycle-v244-r8-20261117/operations-controller.py rollback`. Retém o parent Tex d27cc7c e cadeia de boot, remove só o novo drop-in, verifica PM2/saúde. Não restaura dados vivos ou repete mensagens, pedidos e eventos.

Backup global MongoDB continua FAIL por consistência. A capacidade de disco será reavaliada em cada preparo; limitações de espaço anteriores permanecem registradas como histórico.
