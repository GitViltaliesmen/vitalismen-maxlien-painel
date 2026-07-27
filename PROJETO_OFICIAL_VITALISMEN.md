# Vitalismen Automação Oficial

Esta é a pasta local oficial do projeto Vitalismen neste computador Windows:

```text
C:\Users\Wolfe\Documents\SITES\MAXLIENSHOP_JULHO_2026\Vitalismen Automacao
```

No MacBook, o caminho oficial equivalente permanece:

```sh
cd "/Users/greson/Documents/Vitalismen Automacao"
```

O índice de contexto e referências que deve ser consultado ao abrir o projeto
está em `REFERENCIAS_DO_PROJETO.md`.

## Regra principal

O ambiente oficial de operacao e consolidacao e o VPS. A pasta local existe para revisar, testar e preparar ajustes com seguranca; depois de validar, o ajuste deve ser levado para o VPS. Nao tratar zips, copias antigas ou outras pastas como fonte de verdade.

## Isolamento obrigatório

Quando o usuario pedir para "retomar", "continuar" ou trabalhar na automacao sem citar outro caminho explicitamente, assumir sempre este projeto Vitalismen.

Os caminhos locais autorizados são:

```text
/Users/greson/Documents/Vitalismen Automacao
C:\Users\Wolfe\Documents\SITES\MAXLIENSHOP_JULHO_2026\Vitalismen Automacao
```

O caminho oficial em producao e:

```text
/opt/vitalismen-automacao/current
```

Esta raiz possui o marcador `.vitalismen-official-root`. Antes de qualquer ciclo novo, validar:

```sh
npm run official:path
```

Nao interferir em outros projetos de automacao, incluindo `/Users/greson/Documents/New project 4/[aquecimento total maio de 2026]`, automacoes de aquecimento separadas, copias antigas, zips ou pastas temporarias. Nao abrir, alterar, testar, empacotar, iniciar, parar ou usar esses projetos como referencia sem confirmacao explicita do usuario.

Antes de refazer qualquer automacao, painel, importacao ou fluxo Dropi/WhatsApp:

1. Verificar se ja existe implementacao nesta pasta local oficial.
2. Verificar se ja existe implementacao/estado no VPS.
3. Identificar e ler o arquivo oficial atual antes de editar.
4. Ler os registros em `docs/REGRA_OPERACIONAL_VPS.md` e `docs/ARQUIVOS_OFICIAIS.md`.
5. Atualizar o registro do que foi decidido, feito, testado e pendente.

Regra forte: nunca fazer alteracao com base apenas em copia temporaria, zip, print ou memoria da conversa quando existir arquivo oficial acessivel. Primeiro ler o oficial, depois preparar patch.

Se houver conflito entre versoes, a ordem de prioridade e:

1. VPS em producao.
2. Arquivo oficial registrado em `docs/ARQUIVOS_OFICIAIS.md`.
3. Esta pasta local oficial.
4. Documentacao em `docs/`.
5. Copias antigas, zips ou experimentos: somente referencia, nunca fonte principal.

Para rodar localmente:

```sh
./scripts/start-mongo-local.sh
./scripts/start-api-local.sh
```

Depois abra:

```text
http://127.0.0.1:3001/qr.html
```

Use esta pasta para evitar confusao com zips, copias antigas ou outras pastas do MacBook.

## Funil oficial congelado

O funil inicial Vit Power EC esta registrado como processo oficial congelado em:

```text
docs/FUNIL_ATENDIMENTO_FECHAMENTO.md
```

Regra: nao repetir trabalho ja feito e nao alterar a ordem do funil sem pedido explicito. O funil grava memoria por contato e usa pausas humanas configuradas por `INITIAL_FUNNEL_*` para evitar envio rapido demais.
