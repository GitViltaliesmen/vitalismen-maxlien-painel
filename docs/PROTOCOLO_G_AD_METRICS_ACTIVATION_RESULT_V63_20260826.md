# Resultado de ativação V63 — métricas pós-correção por anúncio do Protocolo G

Data: 2026-08-26

## Publicação oficial

- Pull request funcional: `#81`.
- Commit oficial: `cc85952b6d1cfb80f53bbaae2d5257167a46698d`.
- Tag anotada: `production-20260826-cc85952`.
- Release ativa:
  `/opt/vitalismen-automacao/releases/20260826T054900Z_production-20260826-cc85952`.
- Staging transacional concluído em `2026-08-26T05:50:00Z`, sem alterar
  `current` nem o PID em execução.
- Ativação transacional concluída em `2026-08-26T05:51:09Z` pelo helper
  oficial com autorização root de uso único.
- Rollback preservado:
  `/opt/vitalismen-automacao/releases/20260826T051500Z_production-20260826-10dd893`.
- PID do processo `vitalismen-automation`: `2857447` antes e `2861546`
  depois da ativação.
- `current` e o CWD real do PID apontam para a release V63. O PM2 permanece
  configurado pelos caminhos oficiais
  `/opt/vitalismen-automacao/current` e
  `/opt/vitalismen-automacao/current/src/index.js`.

## Correção do HTML público

O Nginx entrega `/funnel-metrics.html` a partir do arquivo estático
`/var/www/ec.maxlien.shop/funnel-metrics.html`; somente a API de métricas é
encaminhada para a aplicação em `127.0.0.1:3001`. Por isso, a troca da release
atualizou a API V63, mas não substituiu automaticamente o HTML público.

Foi feita uma troca atômica somente desse arquivo estático, usando a cópia
exata da release V63. Não houve alteração ou recarga de configuração Nginx.

- Backup root-only anterior à troca:
  `/var/backups/vitalismen-funnel-metrics-v63/20260826T055500Z/funnel-metrics.html`.
- Hash anterior preservado:
  `3638c3b78037ca50a4f4801aeb60f0e080a7eb58c46cc085cdea5fade0d7d097`.
- Hash V63 ativo, igual ao arquivo da release:
  `841cb396ad02f1312ddc77ae6504ad737fb3fa4de4052ff607696d3c0ff4c086`.
- Modo do arquivo público: `0644`; modo do backup: `0600`.
- O HTML público respondeu HTTP `200` e contém os marcadores
  `protocoloGAdRows` e `measurementStartedAt`.

## Leitura real pós-correção

O corte imutável do bloco Protocolo G é
`2026-08-26T05:13:18.000Z`, instante da ativação V62. A resposta construída
pela mesma projeção e serviço usados no endpoint autenticado retornou
`version=V63` e os seguintes totais:

| Anúncio | Landing | Início do vídeo | 25% | WhatsApp | Conversa | Venda | Purchase |
|---|---:|---:|---:|---:|---:|---:|---:|
| `120248704142390355` | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| `120248709923060355` | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

O único acesso pós-correção identificado veio da campanha
`120248704142400355`, anúncio `120248704142390355`, posicionamento
`Instagram_Reels`. A amostra continua insuficiente: `1/20` no primeiro
anúncio e `0/20` no segundo. Não existe base estatística para atribuir o
resultado atual ao criativo, à retenção da VSL, à CTA, ao WhatsApp ou ao
fechamento.

Como referência diagnóstica, antes do corte os logs mostravam 212 `fbclid`
únicos para o anúncio `120248704142390355`, 71 para o anúncio
`120248709923060355` e somente uma requisição aceita no bridge. Essa evidência
histórica confirmou o gargalo anterior na progressão VSL/CTA, mas não entra
nos números V63.

## Validações concluídas

- CI do PR: Node.js 20, Node.js 22 e Cloudflare Pages aprovados.
- Suíte local e Linux: `386/386` testes do `senior:check`.
- Guard V63: `37/37` testes.
- Lint: `467` arquivos JavaScript validados.
- Auditoria de microcamada de produto, catálogo Dropi, notificações,
  contatos, labels operacionais e freeze lock: aprovados.
- Health local e público: `online`, sem razões de degradação.
- Transporte oficial: Z-API conectada, `connectionStatus=online`,
  `outboundBlocked=false`.
- Permit root consumido e ausente depois da ativação.
- `nginx -t`: configuração válida.
- Processo `cloaker`: `online`, com `pm_cwd=/opt/cloaker` e
  `pm_exec_path=/opt/cloaker/server.js`.

Hashes da VSL preservados:

| Arquivo | SHA-256 |
|---|---|
| `routes/metaEcProtocoloGBridge.js` | `7722081940ceb74b21939e88b54b29f9fb05da9f9e37e87258a4edbd2149f5dd` |
| `private/vsl/protocolo-g.html` | `59b1d47e1c9d7613d1fc30884ce7df78080f9544c730e9435079a0aa39bdfe7b` |
| `public/assets/js/meta-ec-protocolo-g-bridge.js` | `e0904cae1d97ce20b6493aad28b538650ada24c501b38e6a9e382d145e4dccd9` |
| `public/assets/js/tracking-protocolo-g-formulario-20260815.js` | `da4a9415211991cf6669cea2734c1abecc3f516d00f6330c3feb9761ee7839f9` |
| `public/assets/js/pixel.js` | `89449a5822f996725bb8be68058c5363bf62d17a8bb7c7c8ffe0cc306a29937a` |

## Preservado

- VSL V62, player, CTA aos 12 minutos e bridge;
- anúncios, campanhas, orçamento e veiculação na Meta;
- Pixel, Dataset, Meta/CAPI, Lead e Purchase;
- WhatsApp, número oficial, funil, vendedor, mídias, áudios e schedulers;
- produto Tex Ultra, preços, checkout, pedidos e Dropi;
- histórico do banco, que não foi apagado nem reescrito.

Nenhum cliente real recebeu mensagem durante a validação. Nenhum lead, pedido,
envio Dropi, evento Meta/CAPI ou Purchase foi criado, reenviado ou modificado.

## Rollback

Aplicação: reativar a release V62
`/opt/vitalismen-automacao/releases/20260826T051500Z_production-20260826-10dd893`
pelo helper transacional oficial e conferir `current`, PM2, CWD real e health.

HTML público: restaurar o backup root-only registrado acima por troca atômica
e validar o hash antigo. Nenhum rollback da VSL é necessário, pois seus
arquivos não foram alterados pela V63.
