PROJECT=VITALISMEN_EC — VITALISMEN OFICIAL

# Atendimento livre V219-R4: implantação e auditoria

Estado final: publicado e ativo para novas interações elegíveis de Vit Power EC. Commit `822546911b5d2b00e1abde90d8cb5dbecffe72a2`, tag `production-20261115-8225469`. Release real: `/opt/vitalismen-automacao/releases/20261115T201251Z_production-20261115-8225469`. PM2 e `/proc` confirmados no mesmo release; saúde online, Z-API conectada e fila de entrada vazia na leitura final.

## Mudança e regra permanente

Microcamada sobre o Principal SDR Freeflow V212 existente. Perguntas comerciais recebem prioridade na ordem do cliente; dados explícitos são preservados antes da resposta. Preço e composição vêm das fontes oficiais existentes. Condição sem fonte verificada recebe explicação e encaminhamento humano. Perguntas não autorizam registrar um pedido.

A R4 consulta até 40 saídas recentes do mesmo contato e sessão Z-API em 24 horas, considerando criação ou atualização; aplica também o proprietário quando presente no inbound persistido. Usa as mesmas classificações de pergunta da trava de histórico. Se o dado continua faltando, mas a pergunta já foi enviada, responde à dúvida nova sem anexar novamente essa pergunta. Não apaga histórico, não escolhe quantidade a partir de consulta de preço e não contorna dedupe.

Regra local também registrada no AGENTS.md e versionada em `docs/REGRA_SEM_REGRESSAO_ATENDIMENTO_V219.md`. Contrato: `docs/freeze/freeflow-priority-v219-contract.json`. Guard: `scripts/guard-freeflow-nonregression-v219.mjs`. Qualquer delta fora dos 11 caminhos permitidos, adulteração ou gate obrigatório sem PASS bloqueia a publicação. Testes não prometem ausência universal de defeitos.

## Evidências de teste

| Verificação | Resultado |
|---|---|
| Suíte senior completa da R4 | PASS: 43 + 482 + 22 testes, zero falhas |
| Testes focados da R4 | PASS: 176 testes, zero falhas |
| Unidade local antes de selar | PASS: 66 testes |
| Persistência real em MongoDB isolado | PASS: 15 verificações; fornecedor sintético, sem escrita em produção |
| Reprodução de pergunta já enviada em MongoDB isolado | PASS: 16 verificações; dúvida respondida, quantidade não escolhida e pergunta não repetida |
| Inicialização HTTP e autenticação | PASS: 8 verificações; GET/POST anônimos recusados |
| Fila e remetentes reais sob guard, fornecedor local | PASS: 16 verificações, zero mensagens físicas |
| Painel e VSL em navegador com rede interceptada | PASS: 66 + 31 verificações |
| API OpenAI real com conversas sintéticas | PASS: 4 cenários; sem pedidos, WhatsApp ou Meta |
| Adulteração, flags proibidas e inicialização privada | PASS; guards preservados |
| Pós-venda dry-run após implantação | PASS, zero envios físicos |
| Recuperação criptografada de código/configuração | PASS; chave privada não enviada, descriptografia apenas em memória e adulteração rejeitada |

Teste físico da revisão final pelo contato QA final 8637: callback admitido, mensagem persistida, modelo executado, resposta na ordem solicitada, recibo durável único e ACK 3. Intervalo entre entrada persistida e resposta registrada: 2.235 segundos. Nenhum pedido criado. Prova vinculada ao commit final por SHA-256 e exigida antes da promoção para `EC_FORWARD_ONLY`. A janela temporária foi encerrada e o atendimento manual anterior do QA foi restaurado; contato e histórico permanentes preservados.

## Preservado e limites

Painel V218 e ano automático, formulário/nome, VSL/player/CTA, B01/cadência, humano/opt-out, quantidade isolada e formulário estruturado determinísticos, finalizador de pedido, recompra, demais produtos, Dropi, callbacks Z-API, Pixel/CAPI e pós-venda mantiveram os comportamentos e fontes protegidos. B01 continua com ativação `2026-11-15T15:55:50.024Z` e mensuração com `2026-11-15T04:06:13.449Z`; flags legadas permanecem desligadas. Nenhum scheduler novo ou liberação em lote.

VSL móvel, painel e CTA responderam HTTP200. Hash canônico do painel e hash do CTA permanecem iguais ao baseline. A auditoria não constitui prova de 100% de todos os visitantes até o WhatsApp, nem de uma compra real; nenhum pedido real foi fabricado para testar.

Garantia, pagamento, estoque e outras condições sem fonte oficial disponível continuam sujeitos à confirmação humana. O backup global MongoDB permanece FAIL por consistência standalone; PASS de código/configuração não substitui esse backup.

## Ocorrências preservadas na auditoria

O primeiro teste da R2 teve a resposta bloqueada por `history_repeat/ask_quantity`; não houve retry automático nem limpeza de ledger. A R2 teve um teste físico positivo, mas foi revertida ao V216 para corrigir a repetição do complemento da resposta. A R3 foi bloqueada antes de publicar por duas falhas de codificação de texto. A R4 corrigiu a preparação UTF-8 e passou novamente todos os gates.

Houve pressão transitória de disco em um teste isolado anterior. As validações posteriores de banco foram executadas em sequência e as duas provas MongoDB da R4 usaram tmpfs isolado. HTTP/guarded usaram armazenamento descartável sequencial, limpo ao terminar; não se declara que todos os testes usaram tmpfs. O recorte de gateway registrado no incidente não continha entradas comerciais admitidas; isso não prova todos os períodos. Não foram removidos arquivos de outros projetos.

Espaço livre na auditoria final: 495 MB. Para evitar duplicar outro checkout volumoso, arquivos herdados imutáveis foram materializados por hardlink, arquivos alterados e `.env` em cópias independentes; objetos Git duplicados somente do candidato foram substituídos por alternate com conectividade verificada. Os releases anteriores foram mantidos. Nunca editar inode compartilhado em produção: futuras alterações devem criar arquivos independentes em novo release e validar os hashes.

## Recuperação e rollback

Evidências e manifesto SHA-256 fora do Git: `C:\Users\Wolfe\Backups\VITALISMEN_EC\FREEFLOW_V219\20261115-r4`. Incluem bundle do código, configuração criptografada, gates, prova física e captura de tela. Registros raiz em `/var/lib/vitalismen-deploy/ec-freeflow-priority-v219-r4/`; backup operacional em `/opt/vitalismen-automacao/backups/ec-freeflow-priority-v219-r4-20261115/`.

Rollback pontual, se necessário: `python3 -I -B -S /opt/vitalismen-automacao/backups/ec-freeflow-priority-v219-r4-20261115/operations-controller.py rollback`. Retorna ao V216 `8993d2a`, mantém painel V218 e VSL, preserva a credencial ativa, ajusta somente o processo oficial e o drop-in desta revisão e verifica PM2/current/health. Não restaura banco sobre dados vivos e não repete pedidos, mensagens ou eventos. O mecanismo equivalente foi executado no retorno R2→V216; a R4 permanece ativa no encerramento.
