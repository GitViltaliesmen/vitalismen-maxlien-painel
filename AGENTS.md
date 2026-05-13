# Regras Fixas do Projeto

## Isolamento de outros projetos de automacao

Este projeto e somente a automacao oficial Vitalismen / Vit Power Ecuador.

O caminho local unico e obrigatorio:

```sh
/Users/greson/Documents/Vitalismen Automacao
```

O caminho oficial no VPS e:

```sh
/opt/vitalismen-automacao/current
```

Antes de trabalhar, conferir o marcador `.vitalismen-official-root` e rodar `npm run official:path` quando houver qualquer duvida de contexto.

Nao abrir, alterar, comparar, empacotar, testar, iniciar, parar, deployar ou usar como referencia qualquer outro projeto de automacao sem pedido explicito do usuario citando esse projeto.

Projetos fora de escopo incluem, mas nao se limitam a:

- `/Users/greson/Documents/New project 4/[aquecimento total maio de 2026]`
- qualquer automacao de aquecimento separada da Vitalismen;
- copias antigas, zips, pastas temporarias ou projetos paralelos.

Se a conversa disser apenas "retome", "continue", "o bot", "a automacao" ou algo semelhante, assumir sempre esta pasta oficial:

```sh
/Users/greson/Documents/Vitalismen Automacao
```

Antes de usar outra pasta, confirmar com o usuario. Se houver confusao de contexto, parar e reancorar em `.vitalismen-official-root`, `docs/CAMINHO_OFICIAL_UNICO.md`, `PROJETO_OFICIAL_VITALISMEN.md`, `docs/RETOMADA_2026-05-10.md` e nesta regra.

## Arquivos oficiais primeiro

Antes de alterar qualquer VSL, checkout, painel, automacao, funil, Dropi, WhatsApp ou integracao:

1. Localizar qual e o arquivo oficial em producao ou a fonte de verdade registrada.
2. Ler o arquivo oficial atual antes de editar.
3. Ler `docs/ARQUITETURA_AUTOMACAO_OFICIAL.md` antes de mexer em funil, WhatsApp, prompt, audio ou scheduler.
4. Se o arquivo oficial estiver no VPS, baixar ou inspecionar a versao do VPS antes de aplicar patch local.
5. Fazer backup do arquivo oficial antes de substituir em producao.
6. Aplicar a menor alteracao possivel.
7. Validar na URL/servico oficial depois do deploy.
8. Registrar o caminho oficial, backup e validacao em `docs/ARQUIVOS_OFICIAIS.md` ou no documento operacional correspondente.

Nao editar com base em copia temporaria, zip, pasta antiga, `.codex-tmp`, print, memoria da conversa ou suposicao quando houver arquivo oficial acessivel.

## Ordem de prioridade

1. VPS em producao.
2. Arquivo oficial registrado em `docs/ARQUIVOS_OFICIAIS.md`.
3. Pasta local oficial: `/Users/greson/Documents/Vitalismen Automacao`.
4. Documentacao em `docs/`.
5. Copias temporarias ou antigas somente como referencia.

## Funil Vit Power congelado

O funil inicial Vit Power do Equador esta congelado como processo oficial em `docs/FUNIL_ATENDIMENTO_FECHAMENTO.md`.

Nao refazer nem trocar a ordem aprovada sem pedido explicito. A ordem oficial e:

1. `Inicio_01`
2. `Inicio_02`
3. `social_01`
4. `social_02`
5. `vit_power_bottle`
6. texto de valores perguntando quantos frascos deseja

O sistema deve gravar memoria por contato para nao repetir etapas ja enviadas e deve respeitar pausas humanas configuradas por `INITIAL_FUNNEL_*`.

Formulario da VSL/CTA nunca deve ser respondido por IA livre quando trouxer dados de pedido. A regra oficial e deterministica: salvar os dados, perguntar somente campo faltante, ou enviar confirmacao final sem telefone quando estiver completo.

Automacoes legadas que conflitam com o funil Vit Power foram removidas do caminho automatico:

- `src/services/funnelService.js` nao deve voltar.
- Recuperacao de rascunho nao deve voltar ao scheduler.
- Scheduler automatico de envio/retirada nao deve voltar sem decisao explicita.

Antes de testar ou mexer em automacao, rodar:

```sh
npm run senior:check
```

Quando a mudanca envolver o VPS, tambem verificar em producao:

```sh
cd /root/wa_wpp
npm run senior:check
```

O VPS `/root/wa_wpp` possui fluxos antigos bloqueados por flag. Nao religar `SERVER_FUNNEL_ENABLED` nem `AI_WORKER_ENABLED` sem pedido explicito e sem registrar a decisao em `docs/ARQUITETURA_AUTOMACAO_OFICIAL.md`.

Nao religar nem recriar caminhos antigos sem atualizar `docs/ARQUITETURA_AUTOMACAO_OFICIAL.md`.
