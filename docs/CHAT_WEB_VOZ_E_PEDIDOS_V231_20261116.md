PROJECT=VITALISMEN_EC — VITALISMEN OFICIAL

# Chat web, voz Ana Lopez e consulta privada — V231-R2

Publicado e auditado em 2026-11-16T19:05:42.061637+00:00. Backend oficial `/opt/vitalismen-automacao/releases/20261116T182642Z_production-20261116-2aa2738`, commit `2aa2738811b4bc5b755586cad148a2dc7198ac4d`, tree `0134a5849a5e3b59c112735eb79a0d8a07d90a60`. Processo real PID 3686924, cwd `/opt/vitalismen-automacao/releases/20261116T182642Z_production-20261116-2aa2738`. Fonte estática `3c6cba86154b86a5dca18bea0a61e8afa6cddddd`. Os branches e tags são específicos desta entrega; o branch remoto production e o índice/workspace existentes foram preservados.

## Comportamento entregue

O chat da página Vit Power permanece disponível pelo botão Hablar con Ana e acrescenta convite discreto após oito segundos, uma vez por visita visível. Abre na lateral sem modalidade, mantém a VSL utilizável e conserva a liberação original da oferta/checkout. O atendimento por IA reutiliza o catálogo, a memória e os contratos existentes.

Escuchar e Activar voz usam somente respostas daquela sessão, com a voz `qHkrJuifPpn95wK3rm2A`, aprovada pelo operador após a amostra real. Não há áudio automático no convite. A interface informa o envio do texto da resposta à ElevenLabs. A chave está na variável exclusiva `VITALISMEN_WEB_ELEVENLABS_API_KEY`; a variável compartilhada anterior e a credencial OpenAI foram preservadas. O executor de pós-venda não recebe essa nova variável. Repetir uma escuta aproveita o cache e falha de voz preserva o texto.

Estado de mi pedido requer código privado emitido por administrador com JWT válido, inclusive quando existe fallback legado de autenticação local. O administrador confirma pelo canal oficial a identidade do titular, escolhe um pedido EC Vit Power e fornece o código somente a essa pessoa. O código dura 24 horas e fica vinculado ao primeiro navegador que o usa. A consulta relê somente o pedido autorizado, sem mudar seus dados. Informa o último estado guardado, a logística disponível e a data de atualização; não representa uma nova consulta ao transportador. Telefone e endereço não aparecem na resposta. O código não vai ao modelo nem ao histórico quando utilizado pelo formulário privado; a interface também redireciona um código colado por engano no campo normal de mensagem.

O popup do dashboard permite supervisão e emissão explícita desse código; não inclui resposta humana pelo site. O atendimento humano continua pelo WhatsApp. O chat web não cria pedidos, não cobra, não envia WhatsApp, não altera Dropi nem gera Purchase por conversar ou consultar status.

## Evidências e limites

- Testes direcionados finais: 144/144 PASS, incluindo isolamento da credencial no handler real.
- `npm run senior:check` final: PASS, 1656.7 segundos, exit 0. Grupos TAP: # tests 43, # pass 43, # fail 0, # tests 482, # pass 482, # fail 0, # tests 22, # pass 22, # fail 0. Contagens de baterias sobrepostas não foram somadas como testes únicos.
- HTTP real em ambiente isolado: 19 verificações PASS, Mongo descartável/SQLite privado, JWT, vínculo ao navegador, atualização do status e ausência de gravação comercial.
- Transporte de voz pelo aplicativo real, TLS com CA e provedor simulados somente na rede isolada: 21 verificações PASS. Chave dedicada, um pedido ao provedor ao ouvir duas vezes e código de acesso ausente do texto enviado.
- Interface: 42 verificações web em 375/430/1280 e 60 do popup em celular/desktop. Evidências herdadas explicitamente da R1, com JS/CSS/HTML e patches finais idênticos byte a byte; não apresentadas como nova execução visual da R2.
- Nginx: seis casos isolados PASS, aceitando somente o POST exato novo e preservando o prefixo GET. Configuração real validada; um reload gracioso no dashboard, zero restart do Nginx. Site: somente dois assets, sem reload, sem alterar HTML, CTA, player ou timing.
- Modelo OpenAI real: seis cenários, dez conclusões, preço/composição/memória e condição desconhecida. Voz ElevenLabs real: HTTP 200; MP3 de 4,412 segundos validado e aprovado. URL pública após deploy: IA e voz reais, áudio repetido com mesmo hash e códigos/JWT inválidos recusados.
- O caso positivo de consulta privada usa pedido simulado no aplicativo real isolado. Nenhum código de um cliente real foi emitido apenas para testar. O primeiro uso real de consulta com titular verificado segue a operação normal.
- Zero envios WhatsApp, pedidos Dropi ou eventos Meta de teste nesta entrega. Pós-venda dry-run sem saída física. Main bot, preços, atribuição, integração Dropi e arquivos de VSL foram preservados. Os limites existentes de sessão e de uso permanecem; texto/WhatsApp seguem como alternativas quando a voz ou o chat estiverem indisponíveis.

A R1 não foi publicada nem ativada: a auditoria identificou o uso de variável de credencial compartilhada e a R2 a isolou. Suas provas anteriores permanecem preservadas. A primeira tentativa HTTP da R1 expirou enquanto o servidor isolado ainda iniciava; ampliou-se a espera do harness sem mudar a aplicação. A primeira captura ampliada do backup após publicação excedeu o tempo enquanto aguardava o manifesto; o harness passou a consumir os dois fluxos de saída em paralelo, preservando o artefato não validado como failed-timeout. Somente o conjunto capturado novamente e validado integra o PASS. O gravador local da chave foi corrigido para aplicar DACL sem alterar proprietário/auditoria após erro SeSecurityPrivilege. O valor inicialmente fornecido era Key ID; o operador salvou posteriormente o segredo correto por entrada oculta e executou a validação SSH, sem publicá-lo no chat ou no Git.

## Capacidade encontrada e manutenção delimitada

A primeira checagem pública recebeu HTTP 429: as 100 vagas existentes estavam ocupadas, com 91 registros sem qualquer histórico, rascunho, requisição ou turno, criados há mais de uma hora. Esses registros vazios foram movidos para arquivo privado recuperável `/var/lib/vitalismen-web-chat-v220-r2/archived-empty-v231-20261116`, com manifesto SHA-256; os nove históricos existentes foram preservados. Não houve mudança de quotas nem do código para contornar limites. Após a manutenção, uma nova sessão pública iniciou e concluiu IA/voz corretamente. Esse arquivamento pontual não é limpeza automática permanente.

O limite conservador continua em **100 sessões por sete dias, 200 turnos diários e 20 turnos por sessão**. Atingi-lo novamente pode retornar HTTP 429 e orientar ao WhatsApp. Esta entrega não comprova capacidade para tráfego ilimitado nem amplia orçamento. A gestão de capacidade deve acompanhar o aumento do tráfego.

A conferência visual nova na URL publicada validou a resposta de preço, controles de voz/consulta, o recebimento no dashboard e a busca WhatsApp utilizável com o popup aberto. Evidências locais `chat-publicado.jpg` e `dashboard-chat-publicado.jpg`; nenhum código de pedido real foi emitido. O novo MP3 público também foi decodificado como MP3 mono a 44,1 kHz, com duração de 2,926 segundos.

## Recuperação e congelamento

Arquivos oficiais: site `169.58.51.100:/var/www/vitalismen-vitpower-2026g/assets/chat-v220.js` e `.css`; painel `72.60.137.77:/var/www/vitalismen-panel-phonefix-20261108-r1/qr.html`; configuração específica `/etc/nginx/sites-enabled/ec.maxlien.shop.clean.conf`. Backups com hashes e metadados em `C:\Users\Wolfe\Backups\VITALISMEN_EC\WEB_VOICE_STATUS_V231\20261116-r2`; registros operacionais protegidos em `/opt/vitalismen-automacao/backups/ec-web-voice-status-v231-r2-20261116`.

Pacotes opacos criptografados antes/depois passaram em descriptografia em memória, hashes, UID/GID/modos e rejeição de adulteração. Incluem os arquivos e registros novos exigidos por esta camada, com credenciais somente na cópia criptografada. A restauração de uma instalação completa depende também da base e dos registros anteriores preservados. **O backup global MongoDB continua FAIL** por consistência e não é apresentado como backup completo ou restauração dos dados comerciais.

Rollback de backend: controlador `python -X utf8 "C:/Users/Wolfe/Documents/SITES/MAXLIENSHOP_JULHO_2026/Vitalismen Automacao/ops/candidates/web-chat-voice-status-v231-r2-20261116/remote_ops.py" rollback`, retornando ao release pai `/opt/vitalismen-automacao/releases/20261116T163537Z_production-20261116-c03acf1`, aos perfis completos e ao drop-in anterior. Rollback estático: conferir os hashes finais, recuperar somente os dois assets/painel/configuração dos backups registrados, preservar metadados e substituir atomicamente; para Nginx, validar antes do reload gracioso. Não restaurar bancos sobre dados vivos nem repetir mensagens, pedidos ou eventos. Rollback não executado em produção.

Manifesto: `docs/freeze/vitalismen-ec-web-voice-status-v231-20261116.json`. Guia operacional: `docs/GUIA_CHAT_VOZ_E_PEDIDOS_V231.md`. As provas de escopo, testes, publicação e validações permanecem em `C:\Users\Wolfe\Documents\SITES\MAXLIENSHOP_JULHO_2026\Vitalismen Automacao\ops\candidates\web-chat-voice-status-v231-r2-20261116`.
