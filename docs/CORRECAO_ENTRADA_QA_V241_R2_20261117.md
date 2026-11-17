PROJECT=VITALISMEN_EC — VITALISMEN OFICIAL

# Correção auditada da entrada QA — V241 R2

Publicado e conferido em 2026-11-17T17:28:14.818216+00:00. Parent oficial inspecionado: `/opt/vitalismen-automacao/releases/20261117T162142Z_production-20261117-30ca9d6`, commit `30ca9d6f77788186ada1ca7ab2a8cd0962f773b9`. Release desta correção: `/opt/vitalismen-automacao/releases/20261117T164134Z_production-20261117-135d17c`, commit `135d17cc75d71b7401c7f1e9400759e913ad867b`, tree `894e6c5e34891ae33b61c7b9119c04564511670b`.

## Defeito comprovado e correção

A entrada física do QA 8637 foi recebida em 17/11/2026 às 15:30:10.873 UTC, persistida pela Z-API e rejeitada pela exigência de igualdade literal com uma CTA sem nome. A mensagem real com `Nombre: Gerson` tem SHA-256 `abfce890c39b38c8d763d2dbe9073918444c4865784cd872122748b9c6886524`. A simulação usa os mesmos bytes.

O reconhecedor e o roteamento persistido aceitam agora texto natural não vazio, até 700 caracteres, mantendo telefone completo de QA, destino oficial, janela finita, identidade/ID de provedor persistidos, claim, lease e limites. Nome opcional deixa de impedir a entrada. O texto recebido não é reescrito; a CTA pública não serve como senha nem como prova de atribuição de anúncio.

O classificador preserva `Precio` sem interrogação ao lado de uma pergunta delimitada, na ordem em que o cliente escreveu. Preço de envio permanece distinto; contexto não perguntado não vira promessa de garantia/estoque. Consulta não confirma compra.

## Escopo preservado

Delta funcional: oito arquivos — dois apontadores de boot selado, dois serviços pontuais, três testes e um contrato. Os 29 arquivos comerciais protegidos mantêm os mesmos bytes do parent real. B01, pausas, motor, lotes, preços, dados/pedidos, confirmação, agradecimento, humano/opt-out, demais produtos, Dropi, transporte, Pixel/CAPI e pós-venda não foram refeitos. Sete arquivos públicos da VSL, painel e Nginx foram conferidos sem edição por esta entrega.

O parent já contém o chat Tex Ultra R7 recém-publicado. Seus arquivos, segredos internos e provas são herdados. O perfil sucessor valida o hash da prova original e a igualdade dos seis arquivos Tex no parent e no filho. Prova adulterada, segredo/origem inválidos ou alteração de código bloqueiam a autorização. Não se apresenta uma prova do parent como novo teste real do modelo/voz neste filho.

## Auditoria executada

| Verificação | Resultado |
|---|---|
| Testes focados | # tests 197; # pass 197; # fail 0 |
| Senior completo, candidato exato | # tests 43; # pass 43; # fail 0; # tests 482; # pass 482; # fail 0; # tests 22; # pass 22; # fail 0; exit 0 |
| Produto, integridade negativa, flags proibidas, startup isolado, legado somente leitura | 8 etapas PASS |
| Controlador de publicação | 40 verificações PASS |
| Aplicação HTTP com Mongo tmpfs e SQLite descartáveis | 35 verificações PASS |
| QA com conversa anterior simulada | 9 verificações PASS; resposta inicial em 0.5 s, histórico preservado, sem repetir apresentação/mídias, perguntas ordenadas, zero pedido |
| Entrada com nome | Persistida sem edição, aceita, saudação personalizada |
| Perguntas rápidas | Preço e composição numa resposta após silêncio de 60 segundos, na ordem recebida |
| Duplicação | Mesmo callback não repete saudação; QA não gera pedido |
| Venda EC independente | B01 e pausas originais, perguntas, dados/correção, resumo, uma confirmação de 3 frascos/USD 95,99, espelho SQLite e agradecimento |
| URLs públicas | 16 verificações; PASS |
| Recuperação antes/depois | Cópias opacas descriptografadas em RAM, hashes/metadados e rejeição de adulteração PASS |
| Produção | PM2 online, cwd/exec_path do release, perfil/datas herdados, timer, health e Z-API PASS |

Nos testes de saudação, o limite de 5–30 segundos é verificado com tolerância explícita de worker de 0,5/3 segundos; não é um SLA sob qualquer tamanho de fila. O teste rápido usa contato novo elegível. O QA físico possui histórico preservado, que pode bloquear repetição de B01; não foram removidos histórico ou ledgers para forçar uma nova apresentação. Perguntas novas interrompem mídias pendentes conforme a regra herdada.

O modelo e o transporte são simulados no ensaio HTTP. Aplicação, persistência e relógio são reais, em namespaces sem rede externa. Zero envio WhatsApp real, zero Dropi e zero evento Meta decorrentes do ensaio. A prova física após esta publicação continua pendente.

## Falhas mantidas e nova base

O primeiro candidato V241, não publicado, perdeu a invariância de produção durante a suíte completa porque outra entrega autorizada alterou o symlink/PM2. Seu FAIL foi preservado. A correção foi refeita sobre o Tex R7 atual e submetida novamente à suíte completa, com namespace de montagem preso ao parent correto e conferência do processo real antes/depois. Não se substituiu o FAIL anterior por PASS.

A primeira leitura pública depois da ativação teve timeout de rede, sem identificar a URL no wrapper original. A falha está preservada. O verificador recebeu contexto de URL para futuros erros; a nova execução, identificada como posterior à ativação e ligada ao commit, passou nas 16 verificações. Nenhum ajuste de produção foi necessário para essa repetição de leitura.

Dois ensaios HTTP anteriores preservados falharam por fixture de destino incorreta e por esperar B01 completo após perguntas que deveriam interrompê-lo. A primeira tentativa extra deste R2 falhou por escape de newline no código da fixture; foi preservada e corrigida. Nenhuma dessas correções desliga guard ou muda B01 para obter aprovação. A tentativa senior local sem `mongoose` não foi apresentada como aprovação; a suíte válida é a do VPS isolado com as dependências oficiais.

## Publicação, recuperação e próximo passo

Branch/tag exatos foram publicados com index local preservado e sem mover a branch production. A publicação usou o mutex oficial de deploy e o controlador com gates vinculados por SHA. Houve um restart direcionado do processo Vitalismen após verificar ausência de trabalho em B01/lotes/fila/locks; Nginx e MongoDB não foram reiniciados. PID 3806818; cwd real `/opt/vitalismen-automacao/releases/20261117T164134Z_production-20261117-135d17c`; pm_cwd `/opt/vitalismen-automacao/current`; pm_exec_path `/opt/vitalismen-automacao/current/src/index.js`.

O contato 8637 continua fixo, marcado como teste, contido/manual e sem pedido. Nenhuma mensagem antiga foi reinjetada, nenhum novo prazo foi aberto durante os testes longos e nenhum contato foi liberado em lote. Próximo passo: uma única nova entrada física em janela oficial válida, observar recebimento e resposta; depois avançar para as perguntas. Nome não precisa ser apagado.

Cópias e provas externas: `C:\Users\Wolfe\Backups\VITALISMEN_EC\QA_NATURAL_ENTRY_V241_R2\20261117`. Root: `/opt/vitalismen-automacao/backups/ec-qa-natural-entry-v241-r2-20261117`. Rollback exclusivo, documentado e não executado: `python3 -I -B -S /opt/vitalismen-automacao/backups/ec-qa-natural-entry-v241-r2-20261117/operations-controller.py rollback`. Retorna ao parent Tex R7, remove somente o drop-in desta microcamada e confere PM2/perfil/saúde. Depende do parent e da cadeia de boot retidos; não equivale a restaurar a VPS do zero. Não restaura banco vivo nem repete mensagens/pedidos/eventos.

Backup global MongoDB permanece FAIL por consistência; cópia de código/configuração é resultado separado. Não foi criado snapshot da VPS ou cópia de bancos alheios. Espaço livre reduzido permanece limitação operacional a tratar separadamente.

O patch histórico `approved_freezes/diff_congelamento_total_vitalismen_20260517_021215.patch` citado na documentação está ausente no workspace e no release consultados. Documento de congelamento, TXT aprovado e regra V219 foram lidos; a prova atual usa o parent publicado e guards vigentes, sem supor o conteúdo do arquivo ausente.
