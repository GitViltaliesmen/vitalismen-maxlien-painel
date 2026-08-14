# Implantação controlada — continuidade de atribuição Meta Purchase

**Data:** 14 de agosto de 2026  
**Ambiente:** Equador — `ec.maxlien.shop`  
**Dataset/Pixel preservado:** `1468946114265008`  
**Resultado:** correção técnica publicada e validada; Meta Ads não alterado

## 1. Resultado efetivamente alcançado

A produção do Equador passou a preservar uma referência determinística `TX-...` e os sinais legítimos de atribuição no caminho:

```text
landing /n/
→ VslVisit
→ mensagem WhatsApp com TX
→ inbound Z-API
→ telefone
→ ContactState.metadata.tracking
→ Order.tracking
→ payload Purchase CAPI
```

A associação por `TX` exige correspondência exata e compatibilidade com o telefone recebido. Se a referência não produzir associação válida, a ponte anterior por mensagem exata e janela de 120 segundos continua disponível. Dados ausentes não são fabricados.

Foram preservados o construtor e o envio existentes do `Purchase`, `event_name`, `event_id=orderId`, valor, USD, `order_id`, resposta da Meta e locks. Nenhum dos 66 Purchases históricos cegos foi reenviado e nenhum `Purchase` falso foi enviado à produção.

## 2. Produção

### Estado anterior

- Release: `/opt/vitalismen-automacao/releases/202608140449`
- Webroot: `/var/www/ec.maxlien.shop`
- Landing anterior SHA-256: `a976f1698306dae6d7523dd3ca0a492d07281c3e816df585a01f76cd25c5db78`
- Backup integral e verificado: `/opt/vitalismen-automacao/backups/meta-attribution-purchase-20260814T211511Z`

### Estado publicado

- Release imutável: `/opt/vitalismen-automacao/releases/20260814T212844Z_meta_attribution_tx`
- Link ativo: `/opt/vitalismen-automacao/current` → release acima
- Landing pública: `/var/www/ec.maxlien.shop/n/index.html`
- Landing nova SHA-256: `3467ba92076a6fa07d84374fb78e8441ec252db27b52132bd9bac0eee5b7491a`
- Commit funcional local: `83a817a` (`fix(meta): transplanta referência TX na base ativa`)
- PM2: `vitalismen-automation` online, executando `/opt/vitalismen-automacao/current/src/index.js`, com `pm_cwd=/opt/vitalismen-automacao/current`

A release candidata foi clonada da produção ativa e comparada antes da troca. O diff no servidor continha somente os cinco arquivos de runtime e os dois testes listados abaixo.

## 3. Arquivos alterados

### Runtime

- `public/n/index.html`
- `src/models/VslVisit.js`
- `src/routes/whatsapp.js`
- `src/routes/zapi.js`
- `src/services/metaAttributionService.js`

### Testes e documentação

- `tests/meta-attribution-continuity.test.mjs`
- `tests/meta-attribution-purchase-dry-run.test.mjs`
- `docs/handovers/META_ATTRIBUTION_DEPLOY_BASE_20260814.md`
- `IMPLANTACAO_META_ATTRIBUTION_PURCHASE_20260814.md`

Não foi alterado `src/services/metaConversionsService.js`. Também não foram alterados Dropi, Colômbia, preços, textos comerciais congelados, números, anúncios, campanha, conjunto, criativo, DNS ou demais funções do funil.

## 4. Atribuição — antes e depois

### Antes

No recorte operacional de 30 dias auditado:

- 69 Purchases elegíveis foram enviados e aceitos;
- 66 não tinham `fbclid`, `fbc`, `fbp`, UTM, `sourceUrl` nem `external_id`;
- 3 possuíam ao menos algum sinal de atribuição, sendo 1 deles apenas `sourceUrl`;
- não havia referência explícita `TX-...` na release ativa;
- o webroot público derivava `fbc` com timestamp legado em segundos.

### Depois técnico

- `/n/` cria uma referência de sessão `TX-...` e a inclui de modo controlado na entrada do WhatsApp;
- a referência é persistida na `VslVisit` e extraída no inbound Z-API;
- a busca é exata e falha fechada diante de referência inválida ou telefone incompatível;
- `fbclid`, `fbc`, `fbp`, cinco UTMs, `external_id`, `sourceUrl`, IP e user agent são preservados somente quando legitimamente disponíveis;
- novo `fbc` derivado de `fbclid` usa milissegundos e registros legados válidos são normalizados;
- visita sem `fbclid`/cookie não recebe `fbclid` ou `fbc` artificial;
- atualizações parciais da visita não apagam tracking previamente capturado;
- `ContactState` e `Order` herdam tracking sem substituir informação mais específica já existente no pedido.

Os 69 eventos históricos e suas atribuições foram deliberadamente mantidos. O efeito comercial só pode ser medido em tráfego e pedidos futuros que entrem pela landing integrada; não existe alegação de reatribuição retroativa.

## 5. Testes e verificações executados

### Antes da publicação

- `node --check` nos arquivos JavaScript alterados: aprovado.
- Testes de continuidade, ponte existente e Purchase em `dryRun`: **16/16 aprovados**.
- Caso positivo `VslVisit → TX → telefone → Order → Purchase dryRun`: aprovado com os mesmos sinais legítimos da visita.
- Caso negativo sem `fbclid`: aprovado, sem fabricação de `fbclid`/`fbc`.
- Auditoria de regressão Meta EC/painel: aprovada.
- Guard de microcamada de produto EC: aprovado.
- `guard-tex-ultra-approved-v4`: aprovado.
- `senior:check`: aprovado no candidato do servidor.
- Guard público do funil: verificações funcionais aprovadas e artefatos de teste removidos; nenhum Purchase foi enviado.

### Exceção documentada

`audit-ec-nx-funnel-click-path` continua falhando porque procura literalmente o texto antigo `Finalizar por WhatsApp`. A mesma falha foi reproduzida, sem esta correção, na release anterior `/opt/vitalismen-automacao/releases/202608140449`. Portanto, é um guard legado desatualizado, não uma regressão do candidato. O guard e o CTA não foram modificados porque isso ampliaria o escopo autorizado.

### Depois da publicação

- os mesmos testes específicos foram executados pela release ativa: **16/16 aprovados**;
- `/api/health`: `status=online`, `degradedReasons=[]`, MongoDB ativo, Z-API conectada, fila pendente igual a zero;
- PM2 estável no mesmo PID após o reinício controlado, sem reinício adicional;
- `https://ec.maxlien.shop/n/`: HTTP 200;
- a landing com query string também respondeu HTTP 200; o teste foi somente GET, sem executar JavaScript, criar visita ou disparar evento;
- conteúdo público SHA-256 idêntico ao candidato: `3467ba92076a6fa07d84374fb78e8441ec252db27b52132bd9bac0eee5b7491a`;
- marcadores `ACTIVE_VSL_PRODUCT`, `TX-`, `Date.now()` e `attributionRef` confirmados no artefato servido.

## 6. Landing e produto

Uma inspeção dinâmica corrigiu a conclusão estática inicial sobre `https://vilaliemen.shop/protocolo-g`:

- a resposta mobile vende **Tex Ultra**, comprovado pelo ativo do player identificado como `texultra final.mp4`;
- ela carrega o dataset `1468946114265008`;
- captura `fbclid`, UTMs, `_fbc` e `_fbp` com milissegundos;
- aponta o CTA ao WhatsApp oficial `5515991418416`.

O problema é de continuidade entre sistemas: essa landing usa uma infraestrutura paralela e não chama `/api/whatsapp/vsl-entry`, não cria `VslVisit`, não gera `TX` e não transfere os sinais ao `Order` deste backend.

A landing canônica tecnicamente recomendada é:

`https://ec.maxlien.shop/n/`

Motivos: ela também é Tex Ultra, usa o mesmo número oficial, preserva a query string, usa o dataset correto e agora está integrada ao caminho `VslVisit → ContactState → Order → Purchase`.

## 7. Meta Ads — deliberadamente não alterado

- URL atual informada do anúncio: `https://vilaliemen.shop/protocolo-g`
- URL recomendada: `https://ec.maxlien.shop/n/`
- Motivo: manter a identidade do clique no mesmo sistema que forma o pedido e envia o `Purchase`.

Não houve acesso de escrita ao Meta Ads. Anúncio, URL final, campanha, conjunto e criativo permanecem como estavam. A alteração da URL deve ser uma etapa separada, depois de autorização expressa e conferência final no Ads Manager.

## 8. Rollback exato

O rollback não exige migração de banco, pois nenhum registro histórico foi reescrito. Executar no VPS do Equador:

```bash
rollback_link=/opt/vitalismen-automacao/current.rollback-meta-attribution-20260814
rollback_stage=/var/www/ec.maxlien.shop/n/index.html.rollback-meta-attribution-20260814
test ! -e "$rollback_link"
test ! -e "$rollback_stage"
ln -s /opt/vitalismen-automacao/releases/202608140449 "$rollback_link"
cp -p /opt/vitalismen-automacao/backups/meta-attribution-purchase-20260814T211511Z/selected-webroot/n/index.html "$rollback_stage"
test "$(sha256sum "$rollback_stage" | awk '{print $1}')" = "a976f1698306dae6d7523dd3ca0a492d07281c3e816df585a01f76cd25c5db78"
mv -Tf "$rollback_link" /opt/vitalismen-automacao/current
mv -f "$rollback_stage" /var/www/ec.maxlien.shop/n/index.html
pm2 restart vitalismen-automation --update-env
test "$(readlink -f /opt/vitalismen-automacao/current)" = "/opt/vitalismen-automacao/releases/202608140449"
curl -fsSL https://ec.maxlien.shop/api/health
```

Após o rollback, também confirmar `pm2 jlist` e o hash público da landing. O backup contém cópias completas da release e do webroot, além dos arquivos selecionados e checksums.

## 9. Riscos, limitações e pendências reais

- Enquanto o anúncio continuar apontando para a landing externa, os cliques desse anúncio não usarão a nova ponte deste backend. A correção está pronta, mas o ganho de atribuição depende da etapa futura de URL.
- A proporção de Purchases com sinais deve ser monitorada por 24–72 horas depois da mudança autorizada da URL; não há tráfego futuro suficiente no instante do deploy para declarar melhora percentual.
- Compras sem identificadores legítimos continuarão sem atribuição; o sistema falha fechado e não inventa dados.
- O guard legado de texto permanece desatualizado e foi mantido fora do escopo.
- Nenhuma ação foi realizada no Dropi, nas contas Colômbia/Brave, em 2FA ou nas sessões de navegador.

## 10. Estado de parada

A etapa técnica autorizada foi concluída. O sistema está online e o rollback está disponível. O trabalho para neste ponto, antes de qualquer alteração no Meta Ads, conforme solicitado.
