# Painel Maxlien

Painel comercial estatico para operacao unificada de leads de Colombia e Equador.

## O que esta pronto

- filtro por pais e status
- cadastro, edicao e remocao de leads
- status comercial com cores proprias
- compra futura com `agendado` e `data desejada`
- precos e produtos travados por pais e quantidade
- persistencia local com `localStorage`
- exportacao de leads em `.json`
- restauracao rapida dos dados demo

## Publicacao estatica

Este projeto nao precisa de build. Os arquivos principais sao:

- `index.html`
- `styles.css`
- `app.js`

### Netlify

1. Criar um novo site no Netlify.
2. Enviar esta pasta inteira.
3. Definir o diretório de publicacao como `.`.
4. Publicar.

### Vercel

1. Criar um novo projeto no Vercel.
2. Importar esta pasta ou repositório.
3. Manter a configuracao como site estatico.
4. Publicar.

### GitHub Pages

1. Subir estes arquivos para um repositório.
2. Ativar GitHub Pages na branch principal.
3. Publicar a raiz do projeto.

## Deploy automatico com GitHub

O projeto ja esta preparado com workflow em `.github/workflows/deploy-pages.yml`.

Para ativar o deploy automatico no repositório GitHub, adicione estes `Secrets and variables > Actions > New repository secret`:

- `CLOUDFLARE_API_TOKEN`
  Use um token da conta Cloudflare onde esta o projeto Pages `painel-maxlien`, com permissao `Cloudflare Pages:Edit`.
- `CLOUDFLARE_ACCOUNT_ID`
  Use o `Account ID` da conta Cloudflare do projeto Pages.

Depois disso, cada `push` na branch `main` publica automaticamente a versao mais recente no Cloudflare Pages.

## Operacao de vendas

### No estado atual

- o painel funciona localmente ou publicado como site estatico
- os dados ficam no navegador de cada usuario
- a exportacao gera um backup manual em `.json`

### Para producao real

- backend compartilhado para salvar leads
- login por operador
- historico de alteracoes
- sincronizacao em tempo real
- alertas de follow-up
- integracao com WhatsApp, CRM, checkout e logistica

## Checklist antes de publicar

- testar no celular e no desktop
- validar os precos fixos por pais
- validar o fluxo de `agendado`
- confirmar que `exportar leads` baixa o arquivo
- confirmar que `restaurar demo` funciona como esperado
