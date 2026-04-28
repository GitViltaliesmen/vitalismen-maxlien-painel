# Seguranca e Acessos

Guia para manter o painel publicado com acesso controlado e sem credenciais antigas soltas.

## Estado do repositorio

- Projeto estatico, sem backend e sem variaveis de ambiente obrigatorias.
- Nenhum arquivo `.env` foi encontrado no repositorio local.
- Varredura textual local nao encontrou tokens, senhas, chaves ou secrets evidentes nos arquivos do projeto.
- O painel esta com `noindex` e headers basicos de protecao publicados.

## GitHub

1. Conferir se o repositorio correto e `GitViltaliesmen/vitalismen-maxlien-painel`.
2. Remover colaboradores que nao precisam mais acessar o projeto.
3. Revisar chaves SSH e tokens pessoais antigos da conta.
4. Manter push direto apenas com quem realmente publica o painel.
5. Ativar 2FA na conta responsavel pelo repositorio.

## Cloudflare

1. Confirmar que `painel.maxlien.shop` aponta para o projeto Pages correto.
2. Conferir se o projeto Pages esta conectado ao repo `vitalismen-maxlien-painel`.
3. Remover projetos Pages antigos ou dominios duplicados que possam confundir deploy.
4. Revisar membros da conta Cloudflare.
5. Confirmar que apenas a conta correta controla DNS e Pages.

## Tokens antigos

- Revogar tokens que tenham sido usados em testes anteriores.
- Revogar tokens que tenham sido enviados por mensagem, print ou anotacao.
- Criar tokens novos apenas quando houver necessidade real.
- Nunca salvar token dentro de `index.html`, `app.js`, `styles.css`, README ou checklist.

## Publicacao

- Deploy recomendado: Cloudflare Pages conectado diretamente ao GitHub.
- Branch de producao: `main`.
- Build command: vazio.
- Build output directory: `.`.
- O painel deve continuar como area interna com `noindex`.

## Quando evoluir para producao com equipe

- Adicionar login por operador.
- Salvar leads em backend compartilhado.
- Registrar historico de alteracoes.
- Separar permissoes por perfil.
- Evitar depender apenas de `localStorage` quando houver mais de um operador.
