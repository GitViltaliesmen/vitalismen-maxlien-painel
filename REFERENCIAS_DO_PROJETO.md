# Referências do projeto — Vitalismen Automação Oficial

## Raiz local oficial no Windows

```text
C:\Users\Wolfe\Documents\SITES\MAXLIENSHOP_JULHO_2026\Vitalismen Automacao
```

Ao criar ou abrir o projeto no Codex, selecione essa pasta inteira. Não adicione
`src`, `docs` ou arquivos individuais como raízes separadas.

## Ordem de leitura

1. `AGENTS.md` — regras permanentes, limites e validações obrigatórias.
2. `.vitalismen-official-root` — marcador que confirma a raiz oficial.
3. `PROJETO_OFICIAL_VITALISMEN.md` — visão geral e isolamento do projeto.
4. `docs/CAMINHO_OFICIAL_UNICO.md` — caminhos locais e caminho oficial no VPS.
5. `docs/ARQUIVOS_OFICIAIS.md` — fontes de verdade por componente.
6. `docs/ARQUITETURA_AUTOMACAO_OFICIAL.md` — arquitetura do bot, funil e schedulers.
7. `docs/REGRA_OPERACIONAL_VPS.md` — regras de operação e publicação.
8. `FREEZE_LOCK_EC.json` e arquivos `FREEZE_*.md` — estados aprovados e congelados.

## Referências obrigatórias por assunto

- Funil, WhatsApp, áudio ou scheduler:
  `docs/ARQUITETURA_AUTOMACAO_OFICIAL.md` e
  `docs/FUNIL_ATENDIMENTO_FECHAMENTO.md`.
- Painel integrado:
  regras da seção “Regra fixa do painel WhatsApp” em `AGENTS.md`.
- Produto EC, Nitrix ou Vit Power:
  `FREEZE_EC_NITRIX_VIT_POWER_MICRO_LAYER_20260708.md`.
- Dropi, guia e Servientrega:
  documentos `FREEZE_EC_*DROPI*`, `FREEZE_EC_*GUIDE*` e
  `FREEZE_EC_*SERVIENTREGA*` correspondentes.
- Publicação no VPS:
  `docs/REGRA_OPERACIONAL_VPS.md` e `docs/ARQUIVOS_OFICIAIS.md`.

## Validação da raiz

No terminal aberto nessa pasta:

```powershell
npm run official:path
```

O resultado esperado começa com:

```text
[VITALISMEN-OFFICIAL-ROOT] OK
```

O arquivo `.env` contém credenciais e não deve ser usado como referência
documental, anexado a conversas ou compartilhado.
