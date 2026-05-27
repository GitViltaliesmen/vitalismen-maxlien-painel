# Plano seguro - Paineis Leads, Conexoes e Ficha

Data: 2026-05-27
Branch: `codex/leads-clientes-acoes-unificadas`

## Regra de seguranca

- Nao publicar nada antes de revisao visual e funcional.
- Fazer uma tela por vez.
- Preservar backend, APIs, planilhas, banco e fluxos consolidados.
- Antes de mexer em exclusao, importacao, planilhas ou clientes antigos, criar uma trava extra de backup.

## Referencia congelada

- [x] Branch de trabalho criada.
- [x] Backup local de `public/leads-window.html`.
- [x] Backup local de `public/qr.html`.
- [x] Status Git antes salvo.
- [x] Prints publicos antes salvos.

Pasta de referencia:
`.codex_tmp/painel-ref-20260527-094321`

## Decisoes fechadas

- Status oficiais continuam:
  `novo`, `atendendo`, `comprar_depois`, `confirmado`, `pedido_enviado`, `entregue`, `recompra`, `cancelado`, `devolvido`.
- `abandono` nao vira status oficial. Sera alerta/acao humana calculada por 12h sem interacao.
- `Completar dados` e `Confirmar dados cliente` ficam unificados em uma acao dinamica.
- `Excluir` aparece no menu, mas a exclusao real fica bloqueada ate criarmos backup/trava e rota segura.
- Conexoes mantem estrutura multi-numero, mesmo aparecendo so um numero em uso.

## Execucao

### 1. Leads Clientes

- [x] Remover coluna visual separada `Acoes`.
- [x] Mover `Status` para a ultima coluna, no canto direito.
- [x] Colocar menu `...` ao lado do status principal no canto direito.
- [x] Reordenar colunas para telefone, nome, endereco, cidade, provincia, quantidade, valor e status/menu.
- [x] Unificar `Completar dados` e `Confirmar cliente`.
- [x] Manter `Marcar Dropi` para envio em lote.
- [x] Manter `Enviar para Dropi` no menu.
- [x] Mostrar `Dropi enviado` como informacao.
- [x] Adicionar `Abandono 12h` como acao humana para voltar a `atendendo`.
- [x] Adicionar botao visual `Excluir` no menu.
- [ ] Ativar exclusao real apenas depois de backup/trava e rota segura.
- [x] Ajustar proporcao visual das colunas e compactar linhas.
- [x] Validar JavaScript sem erro de sintaxe.
- [x] Validar visual local com dados simulados.
- [x] Validar em previa segura com dados reais, sem permitir escrita.
- [x] Aprovar com usuario.
- [x] Congelar versao aprovada.

### 2. Ficha do cliente

- [x] Reorganizar status principal como fonte visual da ficha.
- [x] Mostrar alerta de dados faltantes sem duplicar botoes.
- [x] Conectar a mesma regra de `Completar/Confirmar`.
- [x] Preservar `Salvar ficha` e confirmacao atual.
- [x] Validar visual com usuario.
- [x] Congelar modelo visual aprovado.
- [ ] Testar busca/aplicacao de agencias com cliente selecionado antes de deploy.

### 3. Conexoes

- [x] Manter estrutura multi-numero.
- [x] Simplificar exibicao para o numero ativo.
- [x] Colocar status geral do pedido abaixo do WhatsApp/numeros.
- [x] Mostrar chamada de `Completar dados` apenas quando quase pronto.
- [x] Preservar iniciar QR, desconectar, Z-API e sessoes.
- [x] Separar operacao Equador e Colombia na visualizacao.
- [x] Tratar conexao como leitura da Z-API, sem conectar celular pelo painel.
- [x] Validar visual com usuario.
- [x] Congelar versao aprovada.

### 4. Atendimento e painel `/m/`

- [x] Verificar se repetem status/acoes.
- [x] Aplicar so a mesma linguagem visual, sem mexer no fluxo.
- [x] Remover numero proprio da Z-API da lista de clientes.
- [x] Filtrar Atendimento por pais selecionado.
- [x] Usar Z-API como estado visual principal, sem QR Baileys no painel.
- [ ] Validar em desktop e mobile.
- [ ] Validar visual com usuario.
- [ ] Congelar versao aprovada.

### 5. Conferir Pedidos / Dropi

- [ ] Revisar depois que Leads/Ficha/Conexoes estiverem estaveis.
- [ ] Garantir que `confirmado`, `pedido_enviado` e Dropi continuam sincronizados.
- [ ] Testar envio individual e envio em lote no ambiente online correto.
- [x] Validacao local do pedido `EC-ADMIN-1918`: envio nao saiu porque a previa local nao tem credenciais Dropi.
- [x] Preservar configuracao Dropi online ja consolidada; nao alterar essa camada agora.

## Falta atualizar agora

- Conexoes aprovado e congelado localmente; falta publicar somente quando houver revisao final.
- Atendimento ajustado em previa local; falta validacao visual/congelamento.
- `/m/` ainda nao foi alterado nesta fase.
- Conferir Pedidos/Dropi fica pendente para validacao no online, sem mexer na configuracao que ja funciona.
- Producao/publico ainda nao recebeu nenhuma alteracao desta fase.

## Observacao sobre dados

Nenhuma planilha, banco, importacao ou lista de clientes antigos foi alterada nesta fase.
