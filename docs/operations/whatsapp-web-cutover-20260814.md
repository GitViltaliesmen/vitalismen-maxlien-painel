# Transição segura de Z-API para WhatsApp Web

## Escopo aprovado

- O destino comercial da VSL permanece `5515991418416`.
- A VSL não será alterada nesta transição.
- O WhatsApp Web deste computador continua disponível para operação humana.
- O conector WhatsApp Web do servidor será vinculado como aparelho adicional para operação 24 horas.
- A Z-API continua ativa como rollback até a validação completa do conector Web.
- O funil Tex Ultra v4, a extensão, o painel, a memória de clientes e o Dropi não são alterados nesta etapa.

## Ponto de recuperação

- Branch da fotografia exata de produção: `codex/production-snapshot-20260814`.
- Commit da fotografia exata: `5920304`.
- Backup privado no VPS: `/opt/vitalismen-automacao/backups/pre-whatsapp-web-cutover-20260814T020306Z`.
- O backup privado contém configuração e estado operacional; não deve ser copiado para o Git.

## Modos operacionais

### `hold_current`

Modo padrão e modo do primeiro deploy. A Z-API continua responsável por entrada e saída. Mesmo que uma sessão Web seja conectada, o dispatcher Web não processa mensagens de clientes.

### `web_test`

Somente os números informados em `WHATSAPP_WEB_TEST_RECIPIENTS` usam o conector Web. A comparação é feita pelos dígitos completos e exatos. Para esses números, o webhook Z-API é ignorado e o failover automático para Z-API é bloqueado, evitando respostas duplicadas. Todos os demais clientes continuam na Z-API.

### `web_primary`

Depois da validação, clientes do Equador passam a usar o conector Web. A entrada Z-API do Equador é ignorada e não há failover automático escondido para Z-API. A rota legada `+57` continua preservada na Z-API.

Requer:

```dotenv
WHATSAPP_WEB_CUTOVER_MODE=web_primary
WHATSAPP_WEB_CUTOVER_APPROVAL=AUTHORIZE_WEB_CUTOVER
```

### `zapi_rollback`

Rollback explícito. O Web para de consumir mensagens e a Z-API volta a assumir o comportamento anterior. A sessão Web pode permanecer vinculada enquanto a causa é investigada.

```dotenv
WHATSAPP_WEB_CUTOVER_MODE=zapi_rollback
```

### `web_only`

Modo final sem Z-API. Está bloqueado até a rota legada `+57` também estar migrada e validada. Sem `WHATSAPP_WEB_CO_ENABLED=true`, uma tentativa de ativação permanece em `web_primary`, conservando essa retaguarda.

```dotenv
WHATSAPP_WEB_CUTOVER_MODE=web_only
WHATSAPP_WEB_CUTOVER_APPROVAL=AUTHORIZE_WEB_CUTOVER
WHATSAPP_WEB_CO_ENABLED=true
```

## Ordem de execução

1. Publicar a nova release com `hold_current` e `WHATSAPP_CONNECT_ENABLED=false`.
2. Confirmar PM2, `/health`, `/api/health`, Z-API conectada, VSL e painel sem regressão.
3. Configurar somente a sessão oficial do servidor e habilitar o motor Web ainda em `hold_current`.
4. Ler o QR em **WhatsApp > Aparelhos conectados > Conectar aparelho**.
5. Confirmar que a sessão conectada pertence exatamente a `5515991418416`.
6. Definir um único número de QA em `WHATSAPP_WEB_TEST_RECIPIENTS` e ativar `web_test`.
7. Validar entrada, texto, áudio, imagem, documento, memória, pedido, Meta e ausência de duplicidade.
8. Ativar `web_primary`, observar os leads reais e conservar `zapi_rollback` disponível.
9. Migrar a rota legada `+57` em uma janela separada.
10. Somente depois da observação aprovada, ativar `web_only`, remover credenciais/runtime Z-API e criar um novo congelamento de produção.

## Critérios obrigatórios antes de avançar

- Sessão Web `connected` e `isReady=true` para o número oficial.
- Nenhum segundo número aparece como destino da VSL.
- Um inbound de teste gera exatamente um registro e no máximo uma resposta automática.
- Texto, áudio, imagem e documento chegam no formato esperado.
- O histórico e a memória do cliente permanecem na mesma conversa.
- A saída do número de QA não faz failover para Z-API durante `web_test`.
- Clientes fora da lista de QA continuam atendidos pela Z-API durante o teste.
- A rota legada `+57` continua operacional enquanto o modo for `web_primary`.
- Os testes automatizados e o guard Tex Ultra v4 permanecem verdes.

## Rollback

1. Definir `WHATSAPP_WEB_CUTOVER_MODE=zapi_rollback`.
2. Reiniciar somente o processo `vitalismen-automation` com o ambiente atualizado.
3. Confirmar `/api/health`: engine `Z-API rollback`, Z-API conectada e fila sem acúmulo.
4. Se a própria release estiver comprometida, reativar o diretório/commit da fotografia de produção e reiniciar o mesmo processo PM2.
5. Não desconectar o aparelho Web nem apagar autenticação durante a investigação; isso preserva uma retomada reversível.
