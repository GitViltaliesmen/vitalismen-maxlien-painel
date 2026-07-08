# Freeze EC Nitrix / Vit Power Micro Layer - 2026-07-08

## Regra maxima

Este congelamento vale como regra maxima para o fluxo `ec.maxlien.shop/n/`: Equador Hostinger, Git Equador, dominio publico `https://ec.maxlien.shop/n/`, Nitrix Oxide como oficial, Vit Power apenas sob demanda explicita, e zero Superfull, Colombia, Contabo, Maxtourus ou outro dominio.

Nao ha autorizacao para mexer no motor principal do bot. Apenas micro camada pontual pode ser avaliada, testada e publicada.

## Estado congelado

- Projeto: Ecuador Maxlien / Nitrix, isolado de Colombia, Contabo, Maxtourus e qualquer outro dominio.
- Dominio publico: https://ec.maxlien.shop/n/
- VPS oficial Hostinger: 72.60.137.77 / srv1182009.hstgr.cloud
- Release ativo no VPS: /opt/vitalismen-automacao/releases/202607081253
- Processo PM2: vitalismen-automation online
- Porta da aplicacao no VPS: 3001
- WhatsApp oficial: 553183002800
- Estado Z-API no health check: connected, Ana Lopez 2800
- Commit local congelado: 760f523 Restore EC observer services for deploy
- Backup/snapshot VPS criado: /root/codex_deploy_backups/ec-nitrix-bot-freeze-20260708133556

## Correcao de nomenclatura

- O produto legado citado para manter sob demanda e Vit Power.
- Superfull nao faz parte desta camada e nao deve ser introduzido, roteado, citado ou aproveitado por engano.
- Nitrix Oxide e o produto oficial da URL /n/ e do CTA atual.

## Regras rigidas de nao contaminacao

- Nao alterar preco, funil comercial, checkout, Dropi, Meta/CAPI, pixel, numero de WhatsApp, dominio publico ou credenciais.
- Nao copiar configuracao, textos, tokens, imagens, audios, rotas ou banco de outro pais/dominio.
- Nao transformar Vit Power em rota automatica para trafego Nitrix.
- Nao alterar o motor principal do bot sem aprovacao explicita.
- Qualquer mudanca permitida precisa ser uma micro camada pontual, com rollback simples e testes antes de publicar.
- Se uma alteracao exigir mexer em fluxo principal, memoria comercial, pedido, shipment, Dropi, preco ou pagamento, ela fica bloqueada para nova aprovacao.

## Micro camada permitida apenas apos validacao

- Nitrix deve continuar como produto oficial para /n/ e CTA.
- Vit Power so pode aparecer se o cliente perguntar explicitamente por Vit Power.
- A micro camada pode acrescentar resposta de "como tomar Nitrix Oxide" sem prometer cura e sem alterar funil.
- A micro camada pode corrigir allowlist/identificacao tecnica minima para Nitrix se isso for necessario para registrar lead do /n/, desde que nao mude o script de venda.
- Micro camada aplicada: ContactState passa a aceitar `nitrix_ec` junto de `vit_power_ec` para impedir falha de validacao no registro do lead /n/.

## Risco encontrado durante o freeze

- O log de producao registrou falha de validacao: assignedAgent `nitrix_ec` nao estava aceito no enum de ContactState durante registro de entrada VSL.
- Isso parece ser falha tecnica de micro camada/allowlist, nao uma autorizacao para reabrir o bot inteiro.
- Antes de liberar qualquer automacao completa para Nitrix, esta falha precisa ser auditada e corrigida de forma pontual.

## Plano seguro

1. Manter o bot congelado no release atual e tratar este arquivo como trava de escopo.
2. Auditar somente os pontos que identificam produto/agente: modelos, agentProfiles, product resolver, rota /n/, CTA JSON e registro VSL.
3. Se confirmado, fazer apenas a micro correcao de allowlist para `nitrix_ec` e a resposta isolada de modo de uso Nitrix.
4. Testar:
   - /n/ registra Nitrix e nao Vit Power.
   - pergunta "como se toma Nitrix" recebe resposta Nitrix.
   - pergunta "tem Vit Power?" permite atendimento Vit Power sob demanda.
   - pergunta normal de preco/compra no trafego Nitrix nao cai em Vit Power.
5. Publicar somente se os guards passarem e o diff nao tocar preco, checkout, Dropi, Meta, pixel, credenciais ou fluxo principal.

## Retomada da micro camada de produto

Aplicacao permitida nesta retomada:

- Ficha do Cliente ganhou seletor controlado de produto apenas para EC:
  - `nitrix_ec` como padrao oficial.
  - `vit_power_ec` permitido somente quando selecionado/identificado explicitamente.
- Pedido manual criado/atualizado pela Ficha passa a enviar `productKey`, `productName` e `product` junto do payload.
- Label do pedido deixa de ter fallback fixo `Vit Power ... frascos` e passa a usar o produto selecionado.
- `Purchase` Meta EC passa a montar `content_name`, `content_ids` e `contents[0].id` pelo produto do pedido:
  - Nitrix: `nitrix_oxide_ec`.
  - Vit Power: `vit_power_ec`.
- Rota de estado WhatsApp aceita somente a whitelist EC `nitrix_ec`/`vit_power_ec` quando `country=EC`.
- O motor principal do bot, precos, Dropi, pixel, Z-API, checkout, funil comercial e credenciais permanecem congelados.

Guard obrigatorio desta camada:

```sh
node scripts/audit-ec-product-micro-layer.mjs
```

Validacoes locais executadas nesta retomada:

- Sintaxe JS dos arquivos alterados: OK.
- Parse dos scripts de `public/qr.html`: OK.
- `scripts/audit-ec-product-micro-layer.mjs`: OK.
- `scripts/audit-ec-nitrix-guard.mjs`: OK.
- `scripts/audit-guide-print-spam-guard.mjs`: OK.
- `scripts/guard-public-funnel.mjs`: OK.
- `scripts/guard-freeze-lock-ec.mjs`: OK.
- `scripts/official-state-audit.mjs`: OK com avisos locais de API/Mongo indisponiveis no Mac.

## Publicacao da retomada

- Commit de implementacao: `4e19a5b Add EC product micro-layer guard`.
- Release VPS ativo: `/opt/vitalismen-automacao/releases/20260708144807`.
- Symlink ativo: `/opt/vitalismen-automacao/current -> /opt/vitalismen-automacao/releases/20260708144807`.
- PM2 `vitalismen-automation`: online com `pm_cwd` e `pm_exec_path` apontando para `20260708144807`.
- URL publica validada: `https://ec.maxlien.shop/n/` respondeu 200 com `productKey: "nitrix_ec"` e WhatsApp `553183002800`.
- Guards no VPS:
  - `scripts/audit-ec-product-micro-layer.mjs`: OK.
  - `scripts/audit-ec-nitrix-guard.mjs`: OK.
  - `scripts/audit-guide-print-spam-guard.mjs`: OK.
  - `scripts/guard-freeze-lock-ec.mjs`: OK.

## Congelamento aprovado final

Congelamento operacional aprovado em 2026-07-08 apos teste real do operador:

- Trafego oficial: `https://ec.maxlien.shop/n/`.
- Produto oficial do trafego: `Nitrix Oxide Ecuador`.
- Produto legado sob demanda: `Vit Power Ecuador`, somente quando selecionado/pedido explicitamente.
- WhatsApp oficial validado: `553183002800`.
- Teste do operador: CTA `/n/` enviou mensagem de Nitrix, contato apareceu no WhatsApp/painel e houve envio/recebimento manual com sucesso.
- Observacao do teste: mensagem `qUIERES NIREIZ?` foi digitacao manual do operador, nao falha do bot.
- Backup final do release ativo: `/root/codex_deploy_backups/ec-product-freeze-20260708151148`.
- Release final ativo no VPS: `/opt/vitalismen-automacao/releases/20260708144807`.
- PM2 final: `vitalismen-automation` online com `pm_cwd` e `pm_exec_path` apontando para `20260708144807`.
- VSL publica validada: `/n/` respondeu 200 com `productKey: "nitrix_ec"` e telefone `553183002800`.
- CTA visual validado: `/n/?showForm=1&test=freeze-final` respondeu 200 com `productKey: "nitrix_ec"` e telefone `553183002800`.
- Painel validado: `/qr.html` respondeu 200 com seletor `customerProductInput`, `Nitrix Oxide Ecuador`, `Vit Power Ecuador` e `productLabelForQuantity`.
- Z-API/WhatsApp validado: endpoints internos `/api/zapi/status`, `/api/zapi/device` e `/api/health` responderam OK.
- GitHub e Git VPS sincronizados na branch `codex-vitpower-unified-front`.
- Proibido deixar divergencia entre Git, VPS, PM2 e pagina publica antes de novo trafego.

## Validacao controlada da Ficha

Validacao feita no contato de teste `5515998038637`:

- Ficha salva no VPS com produto `Nitrix Oxide Ecuador`.
- `productKey`: `nitrix_ec`.
- Quantidade: `1`.
- Valor: `39.99`.
- Status final do contato: teste/BR interno, sem cliente real.
- Resultado operacional: nenhum pedido real criado para o telefone BR de teste.
- Resultado de seguranca: nenhum Dropi e nenhum Purchase real disparado.
- Validacao seca de Purchase EC com pedido sintetico Nitrix:
  - `event_name`: `Purchase`.
  - `content_name`: `Nitrix Oxide Ecuador WhatsApp`.
  - `content_ids`: `["nitrix_oxide_ec"]`.
  - `contents[0].id`: `nitrix_oxide_ec`.
- Guard executado apos a validacao: `scripts/audit-ec-product-micro-layer.mjs`: OK.

## Micro camada de bloco manual Nitrix

Camada permitida sem mexer no motor principal do bot:

- O painel EC passa a mostrar, para contatos Nitrix, o bloco manual `nitrix_inicio_completo`.
- Sequencia do bloco: audio `Inicio Nitrix`, `Prova 1` e `Frasco Nitrix`.
- O frasco isolado `nitrix_frasco` permanece disponivel como bloco manual separado.
- O bloco legado `vit_power_inicio_completo` permanece somente quando o contato estiver marcado como Vit Power.
- O funil automatico e o motor principal continuam congelados; esta camada apenas deixa o material aprovado no painel/manual e pronto para validacao controlada.
