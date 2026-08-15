# Congelado EC - fila operacional de novas mensagens do painel

Status: **APROVADO E CONGELADO**.

- Aprovacao operacional: 2026-08-14, America/Sao_Paulo.
- Publicacao UTC validada: 2026-08-15T01:07:47Z.
- Ambiente exclusivo: Ecuador / `ec.maxlien.shop`.
- Numero operacional: `5515991418416`.
- Release aprovada: `/opt/vitalismen-automacao/releases/20260815T010747Z_ec_panel_default_new`.
- Release anterior preservada: `/opt/vitalismen-automacao/releases/20260815T010100Z_ec_panel_inbox_baseline`.
- Backup verificado: `/root/codex_deploy_backups/20260815T010747Z_ec_panel_default_new`.

## Resultado aprovado

O painel inicia em **Novas** e usa um marco de leitura sem apagar clientes,
mensagens ou historico. Conversas anteriores ao marco continuam disponiveis em
**Tudo**, mas nao reaparecem como novas nem conservam selos de pendencia nos
respectivos numeros.

Depois do marco zero:

1. mensagem realmente nova incrementa o contador de **Novas**;
2. somente clientes com mensagem nao lida, ou entrada nova da VSL aguardando
   atendimento humano, aparecem na fila;
3. a atividade mais recente fica no topo, como na lista do WhatsApp;
4. abrir o cliente registra a leitura no painel;
5. **Lidas** e uma acao explicita de marcacao em massa, nao uma segunda fonte de
   estado;
6. **Tudo** preserva a consulta integral das conversas antigas;
7. o selo individual de pendencia considera somente mensagens posteriores ao
   maior instante entre a ultima resposta enviada e o marco de leitura do
   painel.

## Fontes Git da release

Os dois componentes estao preservados em historicos Git independentes, sem
ancestral comum. E proibido forcar merge entre essas raizes apenas para aparentar
uma unica linha historica.

### Interface

- Repositorio: `GitViltaliesmen/vitalismen-maxlien-painel`.
- Branch: `codex/ec-panel-mark-read-20260815`.
- Commit funcional aprovado: `f35d1ee0cc118db6d3393e91b933a35e2e87bd04`.
- Arquivo: `public/qr.html`.

### Backend

- Repositorio operacional bare: `/opt/git/vitalismen-automacao.git`.
- Branch: `codex/ec-panel-inbox-baseline-20260815`.
- Commit funcional aprovado: `c5cdc9cb9a64c63fbddf377fcd3197a88934c60b`.
- Arquivo: `src/routes/whatsapp.js`.

## Checksums SHA-256 aprovados

- `public/qr.html`: `c37364d1fad8e99a3d5697e3f1c4d657934fdd829d2cae836a1cf9722362a99c`.
- `src/routes/whatsapp.js`: `9893c02f7c7c092e66d39785e22fa555a671bd3ce441b8193943388dfcff0d26`.

O hash da interface na release, no webroot e na resposta HTTPS publica foi
comparado e apresentou o mesmo valor.

## Evidencia de aceitacao

Teste local controlado:

- duas conversas historicas e zero novas abriram em **Novas**, contador `0` e
  nenhuma linha;
- a chegada simulada de uma mensagem exibiu somente o novo cliente, contador
  `1` e nenhum erro de pagina;
- o JavaScript inline foi analisado sem erro de sintaxe;
- `git diff --check` foi aprovado.

Validacao autenticada em producao:

- dashboard abriu em **Novas**;
- 174 conversas historicas permaneceram acessiveis em **Tudo**;
- uma mensagem real recebida depois do marco apareceu como a unica linha nova;
- somente essa mensagem conservou selo de nao lida/pendencia;
- a tela foi devolvida para **Novas** sem marcar a entrada real como lida;
- `vitalismen-automation` ficou online e estabilizou em 0% de CPU;
- WhatsApp Web ficou `connected`, `ready: true`, com uma sessao;
- fila interna ficou com zero tarefas pendentes;
- `/api/zapi/status` confirmou a Z-API conectada ao mesmo numero.

## Escopo preservado

Este freeze nao altera e nao autoriza alterar:

- conteudo das mensagens ou historico dos clientes;
- memoria, banco, funil ou etapas congeladas;
- pedidos, Dropi, Meta/CAPI ou atribuicao;
- textos comerciais, audios, guia ou pos-venda;
- conexao WhatsApp, credenciais, numero ou provider;
- producao de outro pais.

Nenhum dado de cliente foi removido. O marco zero e um estado de leitura do
painel, nao uma exclusao.

## Regra de mudanca

Qualquer mudanca posterior nos criterios de **Novas**, na acao **Lidas**, no
marco de leitura, nos selos individuais, na ordenacao ou no filtro inicial exige:

1. nova branch;
2. backup verificavel;
3. nova release imutavel;
4. testes sem envio comercial;
5. validacao autenticada;
6. aprovacao operacional explicita;
7. novo documento e nova tag de freeze.

E proibido sobrescrever a release aprovada ou reinterpretar conversas antigas
como novas sem autorizacao expressa.

## Observacoes de monitoramento

- O resumo generico de `/api/health` ainda pode exibir `zapi.connected: false`
  enquanto `/api/zapi/status` confirma a conexao real. O endpoint direto foi a
  fonte usada na aceitacao.
- Foi observado um erro isolado de `MutationObserver` no navegador autenticado.
  O termo nao existe nos arquivos alterados e o erro nao bloqueou a fila, os
  contadores ou as conexoes.

## Rollback aprovado

```bash
ln -s /opt/vitalismen-automacao/releases/20260815T010100Z_ec_panel_inbox_baseline \
  /opt/vitalismen-automacao/.current.rollback.tmp

mv -Tf \
  /opt/vitalismen-automacao/.current.rollback.tmp \
  /opt/vitalismen-automacao/current

cp -a \
  /root/codex_deploy_backups/20260815T010747Z_ec_panel_default_new/qr.static.before.html \
  /var/www/ec.maxlien.shop/qr.html

pm2 restart vitalismen-automation
```

Depois do rollback, validar `/api/health`, `/api/zapi/status`, o PM2, o symlink
ativo e os hashes da interface e da rota antes de retomar o atendimento.
