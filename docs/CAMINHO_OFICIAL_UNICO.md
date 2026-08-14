# Caminho oficial unico Vitalismen

## Regra

Os caminhos locais autorizados para a automacao Vitalismen são:

```text
/Users/greson/Documents/Vitalismen Automacao
C:\Users\Wolfe\Documents\SITES\MAXLIENSHOP_JULHO_2026\Vitalismen Automacao
```

O caminho oficial em producao no VPS e:

```text
/opt/vitalismen-automacao/current
```

Qualquer outra pasta, zip, copia, projeto paralelo ou automacao antiga fica fora de escopo.

## Blindagem

A raiz oficial possui o marcador:

```text
.vitalismen-official-root
```

Antes de trabalhar, rode:

```sh
cd "C:\Users\Wolfe\Documents\SITES\MAXLIENSHOP_JULHO_2026\Vitalismen Automacao"
npm run official:path
npm run senior:check
```

Se o caminho atual nao for o oficial, o comando deve bloquear.

## Regra para retomada

Quando o usuario disser "retome", "continue", "o bot", "a automacao" ou algo parecido, assumir sempre o caminho oficial Vitalismen acima.

Nao abrir, testar, limpar, empacotar, iniciar, parar, deployar ou usar como referencia qualquer outro projeto de automacao sem confirmacao explicita do usuario.

Projetos fora de escopo incluem:

- `/Users/greson/Documents/New project 4/[aquecimento total maio de 2026]`
- pastas `New project*`
- zips antigos
- copias temporarias
- automacoes de aquecimento separadas da Vitalismen

Se houver duvida, parar e reancorar nestes arquivos:

- `.vitalismen-official-root`
- `PROJETO_OFICIAL_VITALISMEN.md`
- `AGENTS.md`
- `docs/RETOMADA_2026-05-10.md`
