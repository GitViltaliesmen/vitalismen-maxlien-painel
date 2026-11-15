PROJECT=VITALISMEN_EC — VITALISMEN OFICIAL

# Chat web Vit Power V220-R4 — publicação e auditoria

Chat por texto publicado e ativo em https://taviazen.shop/vitpower_2026g. Commit `025c90c7d5af299e206ee246341d2ec507d929ca`, tree `18c73317979b5420a96c748aaf79f2feaf93ea06`, tag `production-20261115-025c90c`. Release real `/opt/vitalismen-automacao/releases/20261115T225628Z_production-20261115-025c90c`. PM2, symlink e `/proc` conferidos no mesmo release; saúde online e Z-API conectada. A branch production remota foi preservada.

## Funcionamento e escopo

Widget adicional com referência visual pública GIRA21X autorizada. Identidade e catálogo exclusivos Vitalismen/Vit Power; nenhuma aplicação GIRA21X foi modificada. Reutiliza a conclusão OpenAI e os contratos de ferramentas atuais, sem instalar dependências ou criar outro processo de atendimento.

Responde dúvidas na ordem do visitante, consulta preços e composição oficiais e guarda o contexto anônimo deste navegador. A compra continua pelo WhatsApp existente: o botão abre o formulário oficial já aprovado. O chat web não registra pedidos, não cobra, não envia mensagens WhatsApp e não sincroniza automaticamente seu histórico com aquele canal. Voz permanece opcional, sem ativação nesta entrega.

Launcher condicionado à visibilidade da CTA atual; player `69f206413ea7d424b034658c`, tempo 2280s e Turbo 1.2 preservados. `cta.js`, catálogo, funil WhatsApp V219, B01, Z-API, Dropi, schemas, Meta/CAPI e painel preservados. A lista esquerda do painel permanece sem prévias de mensagens.

## Testes e evidências

| Verificação | Resultado |
|---|---|
| Bateria completa senior | PASS — 43 + 482 + 22 testes |
| Focados na versão final | PASS — 206 testes, incluindo 30 novos |
| Integridade, produto e não regressão | PASS; 4 caminhos no sucessor e contrato acumulado de 14; bytes protegidos conferidos |
| Adulteração e flags proibidas | Recusadas; arquivos restaurados e hashes reconferidos |
| Aplicação HTTP completa isolada | PASS — 12 verificações; MongoDB descartável em namespace privado/tmpfs |
| Modelo real | PASS — seis turnos, dez conclusões; composição/preço/memória e condição desconhecida |
| Interface e atribuição simuladas | PASS — 44 asserções, larguras 375/430/1280, rede interceptada |
| Proxy público e IA reais | PASS — cookie isolado, memória, preço oficial, repetição suprimida e entrada privada ocultada |
| Navegador na URL publicada | PASS — resposta real e abertura/cancelamento do formulário WhatsApp |
| QA 8637 | Um contato preservado, marcação de teste e zero pedidos |
| Pós-venda | Dry-run separado; nenhum envio físico de teste |
| Recuperação de código/configuração | PASS — pacotes descriptografados em memória, hashes/metadados e adulteração conferidos |

Abrir/conversar no chat não gera CtaClick/Contact. No percurso simulado completo, a continuação humana gerou um CtaClick e um Contact; PageView/ViewContent, IDs e atribuição fbp/fbc/UTMs foram preservados. A conversa não integrou esses payloads. Nenhum pedido ou evento Purchase fictício foi criado.

As falhas intermediárias e correções de fixtures estão registradas em `TEST_ATTEMPTS.json`; a R1 nunca foi ativada; a R2 ficou restrita ao QA e sua prova revelou a falha de retomada, a R3 ainda dependeu da redação da IA para lembrar a quantidade. A R4 usa leitura direta do histórico nesse caso, sem inventar preços ou escolher pedido. O aceite refere-se à R4. Testes sintéticos não representam uma compra física nem comprovam comportamento de todos os dispositivos.

## Proteções e limites

Cookie Secure/HttpOnly/SameSite, origem e proxy privados, JSON restrito, sessões isoladas e idempotência persistida. Nenhum retry automático de resposta incerta. História até sete dias/quarenta mensagens e vinte interações por sessão; cem sessões, duzentas interações diárias e duas chamadas simultâneas como limites iniciais. O WhatsApp continua acessível quando o chat estiver indisponível ou limitado. Conteúdo de saúde/pagamento não deve ser informado; os padrões privados testados são ocultados e não seguem à IA.

Espaço livre observado na VPS: 461 MiB. Manter o percurso atual é possível; ampliar a carga exige resolver essa capacidade. O crédito da API é o existente e permanece sujeito ao saldo disponível.

## Arquivos oficiais, backup e rollback

Página: `/var/www/vitalismen-vitpower-2026g/index.html`, `desktop.html`, `assets/chat-v220.js` e `assets/chat-v220.css`. Nginx `/etc/nginx/sites-available/taviazen.shop`; proxy de chat privado separado. Backend `/api/web-chat/vitpower`; estado isolado `/var/lib/vitalismen-web-chat-v220-r2`. Painel real `/var/www/vitalismen-panel-phonefix-20261108-r1/qr.html` preservado.

Evidências e pacotes criptografados: `C:\Users\Wolfe\Backups\VITALISMEN_EC\WEB_CHAT_V220\20261115-r4`. Manifesto SHA-256 `44fc8eb69a80688ee3ce0578f0cc81dd0f9a35b66f249567a904e214ffe337f0`. Arquivos privados permanecem somente nos pacotes opacos, fora do Git. Dados comerciais não foram migrados ou restaurados. O backup global MongoDB continua **FAIL** pelo bloqueio de consistência já registrado; este PASS cobre somente código/configuração desta entrega.

Rollback preparado, não executado em produção: desabilitar a capacidade web; remover somente a inclusão do widget/rotas novas após conferir os hashes; restaurar HTML e configurações anteriores com seus metadados. O controller validado em `/opt/vitalismen-automacao/backups/ec-web-chat-v220-r4-20261115/operations-controller.py rollback` volta ao release pai `/opt/vitalismen-automacao/releases/20261115T223508Z_production-20261115-2863c2c`, ao perfil completo anterior e ao drop-in de pós-venda anterior. Não restaurar bancos vivos, não repetir pedidos, mensagens ou eventos. Conferir PM2 real, saúde, Z-API e hashes públicos após qualquer recuperação.
