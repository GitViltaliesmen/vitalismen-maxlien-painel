# PROJECT=VITALISMEN_EC — VITALISMEN OFICIAL

## Resultado auditado — 2026-11-16T20:47:49.250074+00:00

STATUS=PUBLICADO_E_FILA_HABILITADA

O painel ganhou busca por nome informado, identificação do visitante e cidade registrada no popup lateral Chat do site. Visitantes anônimos continuam anônimos. O link público abre o formulário existente Estado de mi pedido, com código privado e verificação de identidade preservados. Não existe concessão automática de acesso a pedidos por telefone ou nome.

Os dois convites ao parceiro são somente mensagens enviadas pelo Vitalismen. Nenhum sistema ou configuração do parceiro foi alterado. A rotina é determinística, usa o transporte Z-API existente e não consulta IA para construir convites. Não registra compras, pedidos, Dropi ou eventos Meta.

## Publicação e fontes oficiais

- Backend ativo: `/opt/vitalismen-automacao/releases/20261116T195949Z_production-20261116-a46af49`; commit `a46af49b47712d6bcb93d116b05d49ad1f845d8a`; tree `918e29be3a0c9f1854a11c319bfe84fcdc9a582e`.
- Origem oficial backend: `72.60.137.77`, `/opt/vitalismen-automacao/current`.
- HTML efetivamente servido: `/var/www/vitalismen-panel-phonefix-20261108-r1/qr.html`.
- Site: `169.58.51.100`, `/var/www/vitalismen-vitpower-2026g/assets/chat-v220.js`.
- Fonte pública independente, compatível com V231/V232: `279e11b5fca9b5da747dbfdfe093efc7bed4334f`.
- Hash painel: `e2fdc6e9f5014ae1758cbd97fa2fa9ffe0c0c433dd8ff23fa87ea9277eedd5e4`.
- Hash JavaScript público: `45a0b32d214ccee248dbf022cb1c085016b920487c47a6dd31c3fd9d611d6b97`.
- Processo efetivo PM2: PID `3700171`, cwd `/opt/vitalismen-automacao/releases/20261116T195949Z_production-20261116-a46af49`, executável `/opt/vitalismen-automacao/current/src/index.js`; health online e Z-API conectado.
- Ativação: um reinício dirigido somente ao processo Vitalismen. Nenhum reinício de Nginx, mudança de rotas ou de outros processos. Timer pós-venda anterior preservado.
- Referências de Git específicas desta entrega; a branch remota production não foi alterada.

## Regras verificadas

Uma tentativa de convite a cada 10 minutos globalmente, entre 08h e 19h no Equador. Avisos operacionais existentes têm prioridade. Convite de consulta único por pedido ativo Vit Power; parceiro 1 após retirada/entrega comprovada ou ausência de pelo menos 12h; parceiro 2 somente após o primeiro confirmado, intervalo de pelo menos 12h e ausência de atividade. Cada convite de parceiro é único por telefone.

Reservas, locks, tentativa, claim de transporte e recibos são persistidos em schema próprio, sem TTL. Histórico consultado antes do envio. Resultado incerto não produz retry automático. STOP atual ou histórico impede novas mensagens; há exclusão de QA 8637, demais brasileiros, contatos sem inbound oficial, atendimento humano, pausas, bloqueios anteriores, cancelados/devolvidos e revisão manual de remessa.

A capacidade de varredura é 1.200 contatos por execução; foram examinados 1060 registros válidos de contato EC. O painel apresentava 1.051 clientes EC no baseline. Aumentar essa capacidade exige revisão antes de superar o limite. O chat do site mantém 7 dias/40 mensagens por conversa, limite de 200 turnos/dia, 20 por sessão e 2 processamentos simultâneos. A entrega amplia apenas o limite de sessões armazenadas para 1.000 e de registros retornados à lista para 1.000; limite de 16MB preservado.

## Testes e evidências

- Senior guard, produto e suíte completa: PASS; resultados abaixo.
- senior_guard: PASS, 54.2s, 
- product_guard: PASS, 35.9s, 
- focused_tests: PASS, 184.4s, # tests 172, # pass 172, # fail 0
- complete_senior: PASS, 1989.3s, # tests 43, # pass 43, # fail 0, # tests 482, # pass 482, # fail 0, # tests 22, # pass 22, # fail 0
- Testes de integridade adulterada, flags proibidas, inicialização isolada e legado somente leitura: PASS.
- Adapter com Mongoose real, boot pós-venda selado, Z-API contra stub privado e guard de destinatário real: 19 verificações PASS; 4 chamadas de provedor simulado, 0 envios reais nesse teste.
- Interface pública offline: 48 verificações PASS, larguras 375/430/1280; popup do painel: 72 verificações PASS. Evidências herdadas da R4 somente após comprovar bytes estáticos idênticos.
- Controlador operacional final R3: 30 verificações PASS. O primeiro leitor confundia um resultado interno com o relatório principal no dry-run; a correção exige um único relatório principal e impede que um PASS interno esconda FAIL externo. O arquivo e binding anteriores foram preservados. A revisão preparatória R2 foi rejeitada pela comparação de hash devido à normalização de novas linhas; não foi ativada. A R3 usa o hash dos bytes efetivos, foi registrada e recuperou corretamente o relatório real. Nenhuma mudança adicional do código da aplicação ou reinício PM2 foi necessária.
- Navegação pública real: busca a425be retornou 1 de 10 conversas; seleção renderizou o histórico; link abriu o formulário privado; nenhuma consulta privada nem mensagem real foi enviada pelo navegador.
- Operação real após habilitar: execução automática PASS_BATCH, resultado NO_ELIGIBLE_RECIPIENT; 0 convite(s) aceito(s) pela Z-API, 0 espelho(s) no painel, 0 com ACK de entrega >=2 no momento da auditoria. Dry-run real PASS com sendCount=0. O primeiro recibo físico de convite permanece PENDING; a simulação não é apresentada como entrega real.
- Diagnóstico somente leitura: 9 contatos com inbound comprovado na sessão oficial atual; 9 em modo humano e 9 em pausa. Nenhum destinatário passou pelas restrições básicas. Outros históricos Z-API não foram atribuídos automaticamente à sessão atual. A fila aguarda elegibilidade; nenhum contato foi liberado ou reenviado para fabricar um teste.
- A segunda mensagem após 12h foi comprovada em simulação isolada; o relógio de produção não foi adiantado e nenhum convite foi forçado para teste.
- Arquivos comerciais protegidos comparados byte a byte com o pai: 12. Bot livre, B01, datas e audiências anteriores, preços, pedidos, Dropi, Meta/CAPI, credenciais e voz aprovados preservados.

## Recuperação e rollback

Backups criptografados e provas de recuperação em `C:\Users\Wolfe\Backups\VITALISMEN_EC\CHAT_CUSTOMER_INVITES_V232\20261116-r5`. Cópias antes/depois incluem arquivos alterados, boot, aprovação/guards, metadados, fonte, configurações privadas opacas e assets publicados. Recuperação em memória, hashes, UID/GID/modos e rejeição de adulteração: PASS. Nenhuma chave privada de recuperação foi enviada ao servidor.

O ledger novo possui cópia própria criptografada em `INVITE_LEDGER.vbe`, com BSON EJSON canônico e metadados de existência/índices. Estava vazio na captura (0 registros); não é apresentado como cópia de envios já realizados. O codec BSON foi verificado por roundtrip de data no runtime. Captura restrita à coleção nova sob o flock já usado pelo único escritor pós-venda. Isso não paralisa gravações comerciais nem constitui backup global. O adendo `CONTROL_AFTER_V232_V3.vbe` inclui controlador final, binding, prova de testes e drop-in final.

STATUS_BACKUP_GLOBAL=FAIL — MongoDB standalone sem consistência global comprovada. A recuperação de código/configuração é PASS separadamente. Nenhum banco comercial foi restaurado, nenhuma migração ou pausa global foi executada.

Suspensão somente dos convites: controlador root `chat-customer-invites-v232-r5-20261116` / ação `disable-invites`; não reinicia PM2 nem apaga o ledger. Rollback completo de código: ação `rollback` do controlador final `operations-controller-v232-r3.py`, removendo os dois drop-ins V232 e retornando ao pai `/opt/vitalismen-automacao/releases/20261116T182642Z_production-20261116-2aa2738`, conferindo PID/cwd/health. Manter o ledger intacto; nunca restaurar memória antirrepetição antiga sobre dados vivos. A restauração não reenvia pedidos, mensagens nem eventos.

## Congelamento

Alterar somente por novo pedido explícito e sucessor validado. Nenhuma lógica anterior deve ser removida para mudar estes convites. O manifesto desta entrega identifica fontes, hashes e evidências; as revisões R1–R4 permanecem como histórico de preparação, sem ativação de backend. A R1 teve teste de limite antigo que falhou e foi corrigido; as demais revisões foram substituídas antes de publicar. Nenhuma falha foi apresentada como PASS.

Consulte `GUIA_CHAT_E_CONVITES_V232_20261116.md` para textos, critérios da fila e instruções de uso.
