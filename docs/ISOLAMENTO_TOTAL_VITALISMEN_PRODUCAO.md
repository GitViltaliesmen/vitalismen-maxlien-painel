# Isolamento total Vitalismen producao

Data: 2026-05-21.

## Decisao oficial

Vitalismen Automacao e a automacao de trabalho real e dinheiro em producao. Ela deve operar como ambiente exclusivo, sem comunicacao tecnica, operacional ou de dados com qualquer automacao de aquecimento, teste, experimento, copia antiga ou projeto paralelo.

Para evitar contaminacao e vazamento, a recomendacao oficial e:

1. Vitalismen deve ficar em VPS propria ou ambiente exclusivo.
2. Aquecimento deve ficar desligado, removido ou movido para outro VPS.
3. Nao deve existir painel supervisor compartilhado entre Vitalismen e Aquecimento.
4. Nao deve existir camada global compartilhada de seguranca entre Vitalismen e Aquecimento.
5. Nao deve existir banco, fila, memoria, log, token, sessao WhatsApp, pasta, porta, usuario de sistema ou deploy compartilhado.

Se for necessario manter Aquecimento no futuro, ele deve viver em ambiente separado e nunca ser usado como referencia automatica para Vitalismen.

## Nivel correto de isolamento

Ordem oficial de seguranca, do melhor para o minimo aceitavel:

1. VPS separada para Vitalismen e VPS separada para Aquecimento.
2. Se nao houver duas VPS, container/usuario Linux separado, rede separada, processos separados, bancos separados e firewall bloqueando comunicacao entre eles.
3. Se estiverem apenas em pastas diferentes no mesmo usuario e mesmo processo supervisor, o isolamento nao e absoluto e nao deve ser considerado seguro para producao.

Para Vitalismen, o padrao aprovado e o nivel 1.

## Identidade oficial Vitalismen

Local oficial no Mac:

```text
/Users/greson/Documents/Vitalismen Automacao
```

Local oficial no VPS:

```text
/opt/vitalismen-automacao/current
```

Marcador obrigatorio:

```text
.vitalismen-official-root
```

Processo, banco, `.env`, auth WhatsApp, logs, backups e scripts de deploy devem pertencer somente a esta identidade.

## O que deve ser proibido

E proibido no ambiente Vitalismen:

- pasta de aquecimento;
- codigo de aquecimento;
- banco de aquecimento;
- fila de aquecimento;
- memoria de aquecimento;
- prompt/persona de aquecimento;
- midias de aquecimento;
- credenciais ou tokens de aquecimento;
- auth WhatsApp de aquecimento;
- logs mistos;
- backup misto;
- painel misto;
- porta HTTP compartilhada;
- processo PM2/systemd compartilhado;
- repositorio Git remoto compartilhado;
- script de deploy que empacote mais de um projeto;
- automacao que leia arquivos fora da raiz oficial do Vitalismen.

## Regra de rede e processo

Vitalismen deve escutar apenas nas portas oficiais dele. Qualquer porta usada por Aquecimento deve estar fora do ambiente Vitalismen.

O processo oficial Vitalismen nao deve chamar endpoint local, API, webhook, dashboard ou healthcheck do Aquecimento.

Aquecimento nao deve chamar endpoint local, API, webhook, dashboard ou healthcheck do Vitalismen.

Nao deve existir cron, scheduler, worker, PM2 app, systemd service ou script que execute os dois projetos no mesmo comando.

## Regra de banco, memoria e arquivos

Vitalismen deve ter banco exclusivo, colecoes exclusivas e chaves de memoria exclusivas. Nenhum registro de cliente, etapa de funil, historico, hash anti-spam, opt-out, pedido, guia, retirada, devolucao ou status logistico pode ser decidido a partir de banco de outro bot.

Backups devem ser por projeto. Backup Vitalismen nao deve conter pasta, auth, banco, `.env`, log ou midia de Aquecimento.

Arquivos temporarios tambem devem respeitar a raiz oficial. Usar `.codex-tmp` somente dentro da pasta oficial Vitalismen quando a tarefa for Vitalismen.

## Regra de segredos

Cada projeto deve ter seu proprio `.env`.

Vitalismen nao deve guardar segredo de Aquecimento. Aquecimento nao deve guardar segredo de Vitalismen.

Segredos proibidos de compartilhar:

- OpenAI API key quando usada para contexto operacional;
- tokens Meta/CAPI;
- credenciais Dropi;
- credenciais WhatsApp/Baileys;
- JWT/admin do painel;
- MongoDB URI;
- chaves SSH de deploy;
- cookies e storage de navegador.

## Regra para IA e contexto

Ao trabalhar em Vitalismen, nao usar arquivos do Aquecimento como base, exemplo, comparacao ou sugestao, exceto se o operador pedir explicitamente uma auditoria de separacao.

Quando a conversa disser apenas "bot", "automacao", "painel", "funil", "cliente", "pedido", "Dropi" ou "WhatsApp", assumir sempre Vitalismen oficial.

Qualquer contexto vindo de pasta paralela deve ser considerado nao oficial ate prova contraria.

## Checklist obrigatorio antes de alterar Vitalismen

Rodar na raiz oficial:

```sh
pwd
node scripts/assert-official-root.mjs
node scripts/senior-guard.mjs
git status --short
```

Confirmar manualmente:

- caminho e `/Users/greson/Documents/Vitalismen Automacao` no Mac ou `/opt/vitalismen-automacao/current` no VPS;
- `.vitalismen-official-root` existe;
- nenhuma pasta de aquecimento esta dentro da raiz Vitalismen;
- nenhum processo de aquecimento esta acoplado ao processo Vitalismen;
- nenhum arquivo de aquecimento sera copiado, importado ou empacotado;
- backup sera somente do Vitalismen;
- deploy sera somente do Vitalismen.

## Checklist obrigatorio no VPS

Antes de restart/deploy:

```sh
cd /opt/vitalismen-automacao/current
pwd
node scripts/assert-official-root.mjs
node scripts/senior-guard.mjs
pm2 describe vitalismen-automacao
pm2 list
```

Validar que nao existe Aquecimento rodando no mesmo PM2/app/porta/pasta. Se existir Aquecimento no mesmo VPS, ele deve ser parado ou migrado antes de considerar Vitalismen totalmente isolado.

## Politica sobre Aquecimento

Estado recomendado para producao Vitalismen:

```text
Aquecimento: desligado ou fora do VPS Vitalismen.
```

Estado local aplicado em 2026-05-21:

```text
Workspace: /Users/greson/Documents/New project 4/[aquecimento total maio de 2026]
Status: congelado
Lock: AQUECIMENTO_CONGELADO.lock
Guard: scripts/freeze-guard.js
Religamento neste workspace: bloqueado sem autorizacao expressa por escrito
```

Se o operador quiser manter Aquecimento:

```text
Aquecimento deve ter VPS propria, Git proprio, banco proprio, auth proprio, .env proprio, porta propria, processo proprio e backups proprios.
```

Nao existe excecao para compartilhar cliente, memoria, fila, funil ou painel operacional.

## Criterio de bloqueio

Qualquer uma das situacoes abaixo bloqueia manutencao/deploy:

- `senior-guard` falha;
- raiz oficial nao confere;
- arquivo de Aquecimento aparece dentro da raiz Vitalismen;
- deploy inclui mais de uma automacao;
- `.env` contem variavel de outro bot;
- auth WhatsApp nao pertence ao Vitalismen;
- banco ou backup contem dados de outro bot;
- painel mostra clientes de outro bot;
- processo inicia Vitalismen e Aquecimento juntos;
- healthcheck depende de outro projeto.

Se bloquear, parar, fazer backup do estado atual e corrigir isolamento antes de continuar.

## Resumo executivo

Vitalismen deve ser tratado como producao critica.

Para isolamento absoluto pratico: Vitalismen em VPS propria, Aquecimento fora. Se Aquecimento voltar, volta como outro ambiente, sem qualquer comunicacao com Vitalismen.
