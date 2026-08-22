# Resultado da ativação V37 — status Z-API após autenticação

## Identificação publicada

- Pull request funcional: `#36` —
  `fix(painel): autentica antes de consultar status Z-API`.
- Commit funcional: `798656b63eced33a8474881261f145a1d0742305`.
- Merge em `production`: `f2e7a69b94b8de52403b4129833f40dfae2ecdbf`.
- Tag anotada: `production-20260822-f2e7a69`.
- Release ativa:
  `/opt/vitalismen-automacao/releases/20260822T052803Z_production-20260822-f2e7a69`.
- Ativação concluída em `2026-08-22T05:29:57Z` pela rotina transacional
  oficial `/usr/local/sbin/vitalismen-stage`.

## Backup e rollback

- Backup protegido anterior à troca:
  `/opt/vitalismen-automacao/backups/pre-panel-zapi-auth-status-v37-20260822T052803Z`.
- Arquivo dos oficiais substituídos: `v36-overridden-files.tgz`.
- SHA-256 do arquivo:
  `aa922804341cb2cecf41b8b93dc266a9741b0c181b47d2af8315dfc7e124e1a8`.
- Cópia protegida do ambiente: `environment.before-v37`.
- SHA-256 da cópia de ambiente:
  `0b2c6bddf5d9a7b7d3fcfaa8bc04f2fac298d8f15e8460288dfa4d6a8b6d61d6`.
- Permissões verificadas: diretório `700`; arquivos `600`; propriedade
  `root:root`.
- Rollback disponível:
  `/opt/vitalismen-automacao/releases/20260822T035923Z_production-20260822-1dbbbe5`.
- O storage compartilhado de mídia inbound não foi removido nem substituído.

## Auditoria da publicação

- GitHub Actions aprovou Node 20, Node 22 e Cloudflare Pages.
- O staging oficial aprovou `npm ci`, auditoria oficial, freeze lock, senior
  check, microcamada de produto, catálogo Dropi, avisos de retirada, contatos,
  selos operacionais e testes de retirada.
- Suíte Linux da release candidata: `278/278` testes aprovados.
- Guard e teste específico V37 após a ativação: `6/6` aprovado.
- Hash SHA-256 de `public/qr.html` local e ativo:
  `0a3e8216886fe92731ab7aa9fdcec370a6bcc4c40c29863c860664dc4dc79e81`.
- Health local: `online`; engine `Z-API`; `connected=true`; `ready=true`;
  nenhuma razão de degradação.
- Health público após redirecionamento, `/qr.html` e `/n/`: HTTP `200`.
- `/api/zapi/status` anônimo continua protegido: HTTP `401`.

## Validação visual pública

- A tela pública sem sessão mostra `SEM LOGIN`.
- `statusText` e `loginStatusText` mostram
  `Faça login para consultar a conexão`.
- `No token provided` não aparece no texto visível.
- O bootstrap servido inicia somente por `bootstrapAuth()`; não existe chamada
  anônima incondicional de `checkStatus()`.
- O HTML oficial usa `Cache-Control: no-store, no-cache`, e o Cloudflare
  respondeu como conteúdo dinâmico.

## PM2 e efeitos reais

- PID anterior: `2111415`.
- PID após reinício controlado: `2119915`.
- Status: `online`; `unstable_restarts=0`.
- `pm_cwd`: `/opt/vitalismen-automacao/current`.
- `pm_exec_path`: `/opt/vitalismen-automacao/current/src/index.js`.
- O CWD real do PID resolve para a release V37 ativa.
- A autorização de ativação foi consumida em uso único.
- Nenhuma mensagem de WhatsApp, mídia, pedido, Dropi ou evento Meta/CAPI foi
  criado como canário durante staging ou validação.

## Resultado funcional

O falso alerta era visual e não indicava desconexão da instância oficial.
O painel agora restaura a autenticação antes de consultar o status Z-API,
mantém estado neutro enquanto não existe sessão e transforma `401/403` em
orientação humana de sessão expirada. A rota sensível permanece autenticada.

Credenciais, instância, token, telefone oficial, transporte, funil, mídia,
pedidos, Dropi, Meta/CAPI, scheduler, avisos de retirada e pós-venda
permaneceram inalterados.
