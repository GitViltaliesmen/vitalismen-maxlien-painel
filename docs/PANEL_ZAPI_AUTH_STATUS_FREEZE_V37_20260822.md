# Freeze V37 — status Z-API após autenticação do painel

Data: `2026-08-22`

País: `EC`

Pai: `ec-all-products-ingredients-v36-20260822`

## Evidência e causa

O operador confirmou visualmente que a instância oficial `EQUADOR_8416`
continuava conectada no provedor. O health público também permaneceu
`online`, com transporte `Z-API`, conexão pronta e nenhuma razão de
degradação.

Mesmo assim, ao abrir o painel sem uma sessão Bearer válida, a interface
exibia `No token provided` como se fosse falha da Z-API. Sair e entrar na
tela novamente não removia o alerta enquanto o formulário de login ainda
estava ativo.

A causa está em `public/qr.html`: o bootstrap executava `checkStatus()` antes
de `bootstrapAuth()`. A consulta protegida `/api/zapi/status` saía sem Bearer,
recebia o `401` correto do backend e copiava o erro técnico para os indicadores
visuais do painel.

## Contrato aprovado

1. `/api/zapi/status` continua obrigatoriamente protegida por
   `authMiddleware`.
2. O painel não consulta essa rota enquanto `state.token` estiver vazio.
3. O bootstrap inicia pela autenticação; uma leitura Z-API só acontece depois
   de `setAuth()` aceitar uma sessão.
4. Ao sair, a interface mostra estado neutro `SEM LOGIN` e orienta a entrar no
   painel, sem declarar Z-API offline.
5. Respostas `401` ou `403` durante uma consulta autenticada limpam a sessão e
   exibem `Sessão expirada. Entre novamente.`.
6. O token da Z-API, o ID da instância e qualquer credencial permanecem fora
   do HTML e dos testes.
7. A consulta de status continua somente leitura e não conecta, desconecta,
   cria sessão, gera QR, envia mensagem ou escreve no banco.

## Preservado

- instância oficial `5515991418416` e transporte Z-API;
- login, usuários, papéis e middleware de autenticação;
- painel integrado, conversas, mídia autenticada, imagens `blob:` e CSP;
- Tex Ultra, Nitrix Oxide e Vit Power;
- preços, ofertas, funis, áudios, imagens e vídeos;
- pedidos, Dropi, Meta/CAPI, pixel e origem VSL;
- scheduler, avisos de retirada, pós-venda e locks antispam;
- PM2, Nginx, Cloudflare e storage compartilhado inbound.

## Validação obrigatória

- sem login, `statusText` e `loginStatusText` não podem conter
  `No token provided`;
- sem token, `checkStatus()` deve retornar antes de chamar
  `/api/zapi/status`;
- com sessão expirada, o painel deve voltar ao login com mensagem humana;
- com Bearer válido, a leitura autenticada da Z-API deve continuar funcionando;
- a rota pública sem Bearer deve continuar respondendo HTTP `401`;
- health público, `/n/`, PM2 e Z-API devem permanecer saudáveis após o deploy.

## Efeitos reais no congelamento

Nenhuma mensagem de WhatsApp, mídia, pedido, Dropi, Meta/CAPI, alteração de
cliente ou escrita no banco oficial foi executada durante a preparação local.

## Rollback

Retornar à release V36
`/opt/vitalismen-automacao/releases/20260822T035923Z_production-20260822-1dbbbe5`,
preservar o storage compartilhado inbound e restaurar o backup de ambiente
criado antes da ativação V37.
