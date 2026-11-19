# VITALISMEN_EC — Pedidos, Dropi, pós-venda e QA V252

Escopo autorizado pelo operador em 2026-11-19. O backend é o sucessor exato do V251; os arquivos públicos preservam as edições concorrentes do painel.

## Comportamento

- Rascunho incompleto permanece em Atendendo. Confirmado requer pedido operacional completo e leitura após gravação.
- Confirmações novas válidas, após o corte de ativação, têm uma tentativa persistida de envio na fila serial existente. Resultado incerto exige revisão; não há replay de confirmações antigas.
- Recompra conserva o pedido entregue e cria seu próprio ciclo. A recuperação de uma venda manual existente usa autenticação nativa de administrador e grant imutável de curta duração emitido pela raiz, após provas de identidade Dropi/guia/contato. Não cria Mongo Order, pedido externo ou Purchase histórico. O vínculo nativo usa atualização atômica por campos e versão do contato, preservando memória concorrente e uma nova negociação. Quando o pedido nativo já existe e a venda foi criada manualmente na Dropi, o vínculo conserva seu ID e snapshot comercial, resolve somente a falha de preflight comprovada e não reenvia o pedido. Recompra a partir de venda externa entregue usa a identidade verificada sem importar um pedido histórico.
- Pós-venda mantém o timer existente, janela do Equador, máximo de uma saída por ciclo, locks e ledger. Consulta limitada também atualiza pedidos que já têm guia. A retirada reconhece as duas fontes já autorizadas em V168B: carrier_tracking e dropi_orders_api. Status final vindo da Dropi mantém a consulta da transportadora e bloqueia aviso logístico desatualizado; não fabrica evidência de entrega para agradecimento ou recompra. A consulta de catálogo envia ECUADOR à API oficial EC, mantendo os produtos e preços aprovados. Renovação da sessão conserva conta e geografia e não repete automaticamente uma tentativa de login malsucedida para o mesmo estado.
- QA 8637 é preservado em Testes, fora de Novas e dos contadores comerciais calculados no servidor. Histórico, dedupe e limites reais da janela de teste permanecem.

## Fontes e publicação

Backend: 959674ce88eed400012b57b28fdef4c6838869b5
Release: /opt/vitalismen-automacao/releases/20261119T160921Z_production-20261119-959674c
Painel público: `/var/www/vitalismen-panel-phonefix-20261108-r1/qr.html`.
Leads público: `/var/www/vitalismen-panel-phonefix-20261108-r1/leads-window.status-only-20261119.html`.
API de status legada: `/opt/maxlien-mvp/app.py`; somente a microcorreção e hashes são versionados, não a configuração privada completa.
Controle e recibos: `/opt/vitalismen-automacao/backups/ec-orders-dropi-postsale-v252-20261119-r11/`.
Os arquivos `qr.html` e `leads-window.html` são fontes da publicação pública independente, não substitutos dos baselines do backend.

## Validação e limites

Os recibos finais identificam a execução real, sem converter simulação em teste físico. Exigir qualification completa, testes de rota com Mongo/SQLite privados, isolamento de rede, navegador, inversões exatas, preservação dos arquivos protegidos e recuperação criptografada antes de publicar/ativar. Falhas e candidatos substituídos permanecem na trilha de auditoria.
VSL, player, CTA, preços, Z-API, voz, memória comercial, Meta e cutoffs anteriores permanecem preservados. A edição V252 do guard V248 aceita exclusivamente o novo painel autorizado e reconstitui os baselines anteriores por inversão exata.
Backup de código/configuração e preimagens dos casos autorizados não equivale a backup global MongoDB, que permanece FAIL.

## Rollback

Executar o controlador com `rollback` somente para a versão ativa desta publicação. Ele restaura primeiro os bytes públicos por inversão verificada e depois o release pai, ambiente PM2 e drop-in anterior. Não restaura dados, apaga ledger, reabre QA ou repete envios. Alteração concorrente bloqueia sobrescrita automática.

## Congelamento publicado

Estado real, testes, recuperaÃ§Ã£o e limites em `docs/EC_PEDIDOS_DROPI_POSVENDA_V252_20261119.md` e `docs/freeze/ec-orders-dropi-postsale-v252-published-20261119.json`. A auditoria concluiu dois vÃ­nculos nativos e um reparo administrativo pontual do recibo GINTRACOM com sua guia alfanumÃ©rica original, alÃ©m de um alias de leitura legado; nÃ£o houve alteraÃ§Ã£o de guard, cÃ³digo do bot, preÃ§o, ledger ou criaÃ§Ã£o de venda duplicada. As preimagens e scripts desse reparo ficam na auditoria privada criptografada, identificada por hash no manifesto.
