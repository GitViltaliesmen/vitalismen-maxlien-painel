# V146-R2 — normalização definitiva e preload oficial auditados

Data da auditoria: 2026-09-08. Escopo: Hostinger oficial `72.60.137.77`, Contabo oficial `169.58.51.100` e código local oficial. A VPS 3 detectada não foi acessada.

## Correção de deployability R2

- A candidata `aa1ecade3633da32503f1bce8da818fcc9a426e0` foi rejeitada corretamente pelo staging oficial porque o preload V97 não registrava os overrides V146 antes dos guards ancestrais.
- A falha V71/V47 foi reproduzida sem o contexto V146 e desapareceu com o contexto carregado; nenhum guard V47 foi alterado.
- `scripts/lib/ec-runtime-successor-v97-context.mjs` permanece o único preload usado pelo staging, pelo controlador V78 e pelo PM2.
- O preload V97 entra no bootstrap V144 existente, que registra primeiro o contexto V146, carrega em seguida V145 e então executa a cadeia ancestral.
- O contexto V146 não reimporta V97 e, portanto, não cria bootstrap paralelo nem ciclo de módulos.
- A regressão completa revelou que o gate V59 passou a reprovar o `sharp 0.35.3`, dependência opcional do Baileys já presente no baseline, após publicação de novos advisories no registry. O override sucessor fixa somente `sharp 0.35.4`; Baileys, libsignal, Z-API e o transporte oficial permanecem inalterados, e `npm audit --omit=dev --audit-level=moderate` retorna zero vulnerabilidades.
- A candidata R2 continua sem autorização de publicação, ativação, permit, troca de `/current`, reinício de produção ou materialização do overlay.

## Baselines e snapshots

- Hostinger aprovada: `/opt/vitalismen-automacao/releases/20260908T162921Z_production-20260908-55f8ef8`.
- Commit pai: `55f8ef8e695ee8569f541f1dbe590647a0aac6c2`.
- Tree pai: `d53dc6a9504800f5589233bfe02bc3b4a5a959f3`.
- Snapshot Hostinger: `/opt/vitalismen-automacao/backups/v146-hostinger-preaudit-20260908T203549Z`.
- Mongo restaurado em ensaio isolado: PASS. SQLite `quick_check`: PASS.
- Snapshot Contabo: `/opt/v146-audit-backups/v146-contabo-preaudit-20260908T203620Z`.
- SHA-256 público da VSL Contabo: `ddf1a65ff3696a10ce7105523397592a85566cb837447210eecb100d3953cf27`, idêntico ao valor aprovado.

## Causas comprovadas

1. O read model priorizava `Order`/`Shipment` terminal sobre `ContactState.metadata.customerDraft`. Isso restaurava `entregue`, endereço, referência, agência, quantidade e valor do pedido anterior depois de salvar a ficha.
2. O frontend mesclava somente `orderId` e `flowDataOk` da resposta, permitindo que o rascunho local antigo sobrevivesse à normalização do backend.
3. O fluxo automático de recompra copiava endereço, referência, modalidade e agência do `Shipment` entregue.
4. O roteador permitia exceções comerciais durante `human.mode=manual`, inclusive após fechamento e em consulta direta de produto.
5. A busca de agência atribuía peso dominante à cidade e filtrava o conjunto por localização antes de respeitar a consulta digitada.
6. A lista esquerda promovia `unanswered`/`unread` antes da atividade e aceitava `updatedAt` genérico como recência.
7. O primeiro elo do pós-venda está desligado na configuração ativa: `DISABLE_SCHEDULER=1`, polling e dispatch desligados. Os serviços, locks persistentes, histórico e dedupe V65/V66/V139 existem.
8. `/vsl-entry` tratava clique genérico do WhatsApp como `InitiateCheckout`. O bridge Contabo já entrega campaign, adset, ad, placement, fbclid, fbc, fbp e visitor/session; não há causa para alterar a VSL.
9. A confirmação da ficha ainda continha uma tentativa de `Purchase` anterior ao sucesso Dropi humano. O V146 remove esse caminho e conserva o único gatilho V144 após submit Dropi novo, humano e aceito.

## Comportamento candidato

- `entregue → recompra` cria ou reutiliza um `Order` novo com `previousOrderId`, status inicial `draft` e identificador `EC-RECOMPRA-*`.
- Pedido e `Shipment` entregues permanecem imutáveis.
- Nome, telefone, cidade e província continuam como identidade do cliente. Endereço, referência, modo, agência, quantidade e valor iniciam vazios no novo ciclo.
- Salvar novamente o mesmo ciclo reutiliza o `Order` aberto.
- Confirmar diretamente uma ficha ainda ligada a pedido terminal abre o novo ciclo e exige os dados próprios do novo pedido antes da confirmação.
- O backend não cria Shipment, não autoriza Dropi e não envia Purchase na criação ou confirmação do ciclo.
- Com takeover humano ativo, o bot retorna antes de qualquer resposta. Depois de liberação legítima para `auto`, uma intenção explícita pode seguir o funil existente.
- O melhor resultado de agência fica primeiro e recebe destaque visual; nenhuma sugestão é aplicada sem clique do operador.
- `lastActivityAt` passa a representar a última mensagem inbound/outbound ou interação humana/bot aplicável, sem usar `updatedAt` genérico.
- Clique de WhatsApp continua como `Lead`; `InitiateCheckout` ocorre ao iniciar checkout/formulário/pedido pendente com quantidade explícita. Ocorrência, envio, aceite, `event_id` e lock ficam persistidos.
- O overlay revisável de pós-venda está em `ops/candidates/v146-postsale-runtime.env.example`. Ele não foi aplicado.

## Evidência viva e Meta

- Pedido entregue alvo: `EC-MQPF0XB1-0BUO`. Nenhum pedido aberto existia antes da auditoria.
- Consulta viva Servientrega: `Entregado`, normalizado `ENTREGADO`.
- SHA-256 do documento `Shipment` antes/depois: `0ec64c10f1a58146ac2903ca71f5c15597b51b7a303185e590ec31a16a9ff8f4`; nenhuma mutação.
- Último código histórico comprovado com `InitiateCheckout`: commit `2ed96653be36b919371d32f384c269a3ba75a9a7`, 2026-08-13T23:04:12-03:00. As janelas 2026-08-11–25 e 2026-09-01–08 não contêm fatos `metaInitiateCheckoutSentAt` no Mongo atual.
- Test Event sintético `InitiateCheckout`: HTTP 200, `events_received=1`.
- Test Event sintético `Purchase`: HTTP 200, `events_received=1`.
- Mensagens reais: 0. Dropi real: 0. Purchase real de teste: 0.

## Travas

O candidato não publica, não troca `/current`, não cria permit, não reinicia PM2 e não altera configuração de produção. A VSL e o roteamento da Contabo permanecem byte a byte iguais. Toda ativação depende de nova aprovação humana.
