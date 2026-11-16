# PROJECT=VITALISMEN_EC — VITALISMEN OFICIAL
# Fechamento conversacional V230-R4 — publicado, auditado e congelado

Registro UTC: 2026-11-16T17:32:56.009931+00:00. Fonte oficial: `/opt/vitalismen-automacao/releases/20261116T163537Z_production-20261116-c03acf1`, commit `c03acf15b9baeee4116577b01caf3c0fd194cac4`, tree `62e377b6ebc2f5318689ba0c41e0891b44e1dd98`. O processo real executa esse release; a publicação conserva o branch `production` e os commits anteriores.

## Problema e correção
A confirmação curta não seguia ao agente após o resumo; o resumo também mudava de hash entre turnos por omissão de `productKey`. O teste integrado revelou outra incompatibilidade: o finalizador Mongoose salva o pedido por `_id`, enquanto a proteção da fila reconhecia somente `orderId`.

A microcamada persiste os estágios comerciais existentes, calcula o resumo com o produto da oferta oficial, verifica o telefone com e sem `+` e aceita `updateOne` pelo `_id` somente do pedido inserido pela mesma execução autorizada. Identificadores externos, outra execução, inserção de outro contato, gravação em massa e upsert permanecem bloqueados. O teste concorrente do chat usa sinalização explícita de início em lugar de uma espera fixa de 30 ms; o comportamento do chat público não mudou.

## Evidências verificadas
| Verificação | Resultado |
|---|---|
| Reprodução dos defeitos do agente | Baseline 61/68; versão corrigida 68/68 |
| Proteção do pedido por identidade | Baseline 11/12; versão corrigida 12/12 |
| Testes direcionados da versão final | 351/351 PASS |
| `npm run senior:check` completo | PASS, 1655.5 segundos, exit 0 |
| HTTP real isolado: autenticação, entrada e histórico QA | 37 verificações PASS |
| Perguntas rápidas / reinício com fila / controle humano | 31 / 32 / 34 PASS |
| Funil completo até a venda | 22 verificações PASS; saudação em 19.999 segundos |
| Modelo OpenAI real | 5 cenários PASS, sem envios ao WhatsApp ou criação de pedidos |
| WhatsApp físico 8637 após ativação | Entrada real, resposta agrupada após 64.392s e ACK 3 |
| Pedido Dropi 7982030 | Já enviado, referência única, preservado sem reenvio |
| Recuperação de código e configuração, antes/depois | PASS, arquivos e metadados verificados em memória |
| Backup global MongoDB | FAIL: consistência do standalone ainda sem solução comprovada |

No percurso simulado, o cliente pergunta primeiro o preço e depois a composição, informa 3 frascos e Quito, escolhe domicílio, completa os dados e corrige o endereço. O sistema atualiza o resumo sem vender antecipadamente. `Sí, confirmo` registra exatamente um pedido de **3 frascos / USD 95,99**, obtém recibo persistido e espelha **confirmado** no painel SQLite. Repetir a confirmação mantém um único pedido. Esse ensaio usa a aplicação HTTP real, MongoDB e SQLite descartáveis, relógio nativo e chamadas de ferramentas simuladas; não representa uma venda física nem um recebimento da Meta. Não houve pedido Dropi, evento Meta ou mensagem real nessa simulação.

O teste físico posterior usa somente o contato permanente 8637, com janela finita e sem pedidos. Os IDs de entrada, recibo do gateway, ledger, memória do modelo e entrega são conferidos juntos. A janela de QA é contida ao final, preservando o contato e seu histórico.

## Preservado e limites
VSL, painel, preços, origem do produto, integrações e credenciais permanecem preservados. Os 115 testes de navegador anteriores são evidência herdada do frontend idêntico; esta entrega revalida HTTP, bytes publicados e backend, sem declarar uma nova suíte visual de 115 testes. A pausa de 60 segundos para agrupar perguntas, o controle humano, o timer de pós-venda e os mecanismos de idempotência continuam ativos.

O primeiro teste físico desta versão foi bloqueado corretamente por resposta idêntica ao histórico. O lote 8637 foi cancelado administrativamente após provar ausência de transporte, mantendo histórico, IDs vistos, ledger terminal e bloqueio humano; o estado anterior foi copiado de forma opaca criptografada. Na segunda janela, três perguntas enviadas antes da assinatura de entrada exigida pelo QA foram registradas, mas não roteadas. Após a entrada padrão, quatro mensagens novas foram admitidas e produziram uma única resposta para preço de 6 frascos e composição, sem repetir o lote bloqueado. A pergunta sobre a cidade recebeu orientação geral de entrega; a recuperação da cidade salva NÃO está comprovada por esse teste físico. A captura `qa-reply-v230-r4.png`, com SHA-256 no manifesto, confirma visualmente a resposta às 14:29 no horário do computador.

As falhas anteriores permanecem registradas: V230-R1 reprovada por gravação bloqueada e corrida do teste; V230-R2 comprovou o fechamento, mas foi substituída para preservar LF; V230-R3 teve a validação de registro rejeitada por referência incorreta de helper e não foi ativada. Somente V230-R4 é a versão publicada desta entrega. Logs e provas ficam em `C:\Users\Wolfe\Documents\SITES\MAXLIENSHOP_JULHO_2026\Vitalismen Automacao\ops\candidates\sdr-sale-v230-r4-20261116` e no diretório protegido `/opt/vitalismen-automacao/backups/ec-sdr-sale-v230-r4-20261116`.

## Congelamento e rollback
Manifesto: `docs/freeze/vitalismen-ec-sdr-sale-v230-20261116.json`. Backups opacos criptografados: `C:\Users\Wolfe\Backups\VITALISMEN_EC\SDR_SALE_V230_R4\20261116`. Os hashes SHA-256, UID/GID, modos e arquivos de boot são conferidos; segredos não integram Git ou este documento. O backup global continua FAIL e não é apresentado como backup completo.

Para rollback de código/configuração, usar o controlador validado `python -X utf8 C:/Users/Wolfe/Documents/SITES/MAXLIENSHOP_JULHO_2026/Vitalismen Automacao/ops/candidates/sdr-sale-v230-r4-20261116/remote_ops.py rollback`. Ele retorna somente ao release pai `/opt/vitalismen-automacao/releases/20261116T135533Z_production-20261116-642ff47`, restaura o perfil herdado e remove apenas o drop-in próprio da V230-R4, verificando o processo PM2 real e a saúde do serviço. Não restaura bancos sobre dados vivos e não repete pedidos, mensagens ou eventos. O rollback não foi executado nesta entrega.
