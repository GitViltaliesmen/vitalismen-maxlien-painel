# Baseline EC Integrada 2026-06-12

Status: congelada para continuidade segura.

## Objetivo

Manter como base oficial do Equador a versao integrada do painel, funil, bot observador e camadas operacionais que estavam ativas antes da separacao de paises.

## Referencia visual e funcional

- `public/qr.html` com:
  - botao `Emoji` ao lado da caixa;
  - botao `Funil` na barra inferior;
  - drawer lateral do funil;
  - rodape com estados compactos;
  - painel integrado carregado na mesma tela.
- `public/leads-window.html` acoplado ao shell integrado e sem reintroduzir rotas antigas de contaminação.

## Ponto de rollback

Se qualquer camada retroceder, voltar imediatamente para:

- `public/qr.html`
- `public/leads-window.html`

Antes de promover qualquer nova mudanca, validar esta base no navegador local e no VPS.

## Regra de continuidade

1. Nao introduzir outro pais no caminho oficial do Equador.
2. Nao remover o funil, o emoji, o drawer ou os estados compactos sem pedido explicito.
3. Toda mudanca futura deve passar por:
   - `npm run senior:check`
   - abertura visual do painel local
   - comparacao com esta baseline
