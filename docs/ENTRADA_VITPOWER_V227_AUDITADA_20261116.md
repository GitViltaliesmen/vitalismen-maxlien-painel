PROJECT=VITALISMEN_EC — VITALISMEN OFICIAL

# Correção da entrada Vit Power V227 — 16/11/2026

Estado: publicado e ativo em 07:24:17.039Z. Esta publicação corrige a entrada e a identidade da sessão. O agrupamento de perguntas por 60 segundos é uma alteração posterior V228, não incluída neste freeze.

## Causa e alteração mínima

A CTA comercial atual era reconhecida como pergunta direta e perdia o contexto explícito Vit Power antes do roteamento. Depois, `saveInboundMessage` derivava o proprietário de `sessionId=zapi`, produzindo string vazia e sobrescrevendo a identidade oficial já registrada. Assim, a entrada era recebida, porém não alcançava o atendimento automático elegível.

A rota passa a conservar o produto somente para a assinatura exata da CTA atual, com nome opcional limitado. O roteador deixa de sobrescrever a identidade verificada quando a sessão é simbólica. Não há atribuição arbitrária de produto, backfill ou replay de mensagens antigas. As saídas manuais mostradas no incidente não foram consideradas prova automática.

## Fonte e publicação

- Origem: `72.60.137.77:/opt/vitalismen-automacao/current`.
- Release: `/opt/vitalismen-automacao/releases/20261116T065554Z_production-20261116-7db0a30`.
- Commit: `7db0a30bf7397c768294f626b555b2d3c99fee34`; tree `def52a6b84495c684f05112b086d63becc28f038`.
- Tag: `production-20261116-7db0a30`; branch `codex/ec-inbound-routing-v227-r1-20261116`. Branch production preservada.
- Sucessor root: `/usr/local/lib/vitalismen-deploy/ec-inbound-routing-sealed-v227-r1.mjs` e perfil correspondente; estado `/var/lib/vitalismen-deploy/ec-inbound-routing-v227-r1`.
- PM2 confirmado no PID3603657, `pm_cwd=/opt/vitalismen-automacao/current`, `pm_exec_path=/opt/vitalismen-automacao/current/src/index.js` e cwd real no release publicado.
- Z-API conectada e health online. Flags e datas herdadas preservadas, incluindo a mensuração e B01. Workers legados continuam desligados.

## Testes e limitações

- Senior guard e guard de produto: PASS; 235 testes focados: PASS; suite senior completa: 547 PASS (43+482+22), 1.164,5 segundos.
- Aplicação real em namespace de rede isolado e Mongo descartável: 27 verificações PASS, incluindo CTA → produto → identidade → saudação B01, callback duplicado sem envio adicional e autenticação administrativa.
- Quatro conversas sintéticas com a API real do modelo: PASS; preço/composição, dados/entrega, fatos indisponíveis com humano e memória. Zero escrita operacional, WhatsApp, pedido, Dropi ou evento Meta nesses testes.
- Adulteração de código/preload e flags proibidas rejeitadas; startup isolado e senior readonly de `/root/wa_wpp`: PASS. Cinco verificações do controlador: PASS.
- Frontend V226, Nginx e VSL preservados. Evidência browser115 herdada explicitamente; não se alega reexecução dessa suite.
- A primeira execução focada atingiu timeout140s; o resultado foi preservado e a repetição completou235/235. Senior local não executou por ausência de mongoose; a validação com dependências oficiais foi feita no candidato da VPS.
- Uma nova entrada física no WhatsApp após a correção ainda precisa ser observada. Simulação, API real isolada e recibos antigos não substituem essa prova.
- A ficha do incidente permanece sob controle humano. Nenhum pedido/envio/replay foi realizado como parte da correção. Alterações comerciais feitas pelo operador foram preservadas.

## Recuperação e rollback

Backup de código/configuração: `/opt/vitalismen-automacao/backups/ec-inbound-routing-v227-r1-20261116` e cópias opacas em `C:/Users/Wolfe/Backups/VITALISMEN_EC/INBOUND_BOT_V227/20261116`. Envelopes BOOT_BEFORE_V227 e RUNTIME_CONFIG descriptografados e validados em memória, hashes/metadados conferidos e adulteração rejeitada. Recuperação limitada a código/configuração, sem chave privada enviada à VPS ou plaintext gravado.

Rollback exclusivo desta camada, apenas quando V227 for o release ativo: `python3 -I -B -S /opt/vitalismen-automacao/backups/ec-inbound-routing-v227-r1-20261116/operations-controller.py rollback`. O controlador restaura o parent e perfil anterior, retira somente seu drop-in do pós-venda e confirma PM2/health. Não restaura banco, reenvia pedidos ou mensagens. Caso haja sucessor ativo, usar primeiro o rollback desse sucessor.

O backup global MongoDB continua FAIL por falta de captura consistente comprovada no standalone. Não houve migração, restauração ou pausa de gravações de produção.

## Evidências

`ops/candidates/inbound-bot-v227-20261116/{STAGED,REGISTERED,QUALIFICATION,EXTRA_QUALIFICATION,HTTP_TEST,LIVE_MODEL_TEST,PUBLICATION,ACTIVATION,LIVE_AUDIT}.json`. Esses registros contêm evidência operacional; arquivos privados do incidente e segredos não integram o freeze público.
