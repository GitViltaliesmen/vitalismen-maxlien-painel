# Resultado de ativação V62 — conversão mensurável do Protocolo G

Data: 2026-08-26

## Publicação Vitalismen EC

- Pull request: `#79`.
- Commit oficial: `10dd893c0299fce65c029c9421c4854b753eaad5`.
- Tag anotada: `production-20260826-10dd893`.
- Release ativa:
  `/opt/vitalismen-automacao/releases/20260826T051500Z_production-20260826-10dd893`.
- Ativação transacional concluída em `2026-08-26T05:13:18Z` pelo helper
  oficial com autorização root de uso único.
- Rollback preservado:
  `/opt/vitalismen-automacao/releases/20260825T030459Z_production-20260825-75ed74b`.
- PID do processo `vitalismen-automation`: `2736475` antes e `2857447`
  depois da ativação.
- `current`, `pm_cwd`, `pm_exec_path` e o CWD real do PID apontam para a
  release V62.

## Publicação da VSL

- Origem oficial: `/opt/cloaker` no host `vilaliemen-protocolo-g`.
- Backup root-only anterior à troca:
  `/opt/cloaker/.backups/protocolo-g-v62-20260826-0514Z`.
- O backup e seus diretórios usam modo `0700`; arquivos e `SHA256SUMS` usam
  modo `0600`.
- Processo `cloaker`: `online`, PID `564127`, `pm_cwd=/opt/cloaker` e
  `pm_exec_path=/opt/cloaker/server.js`.

Hashes ativos:

| Arquivo | SHA-256 |
|---|---|
| `routes/metaEcProtocoloGBridge.js` | `7722081940ceb74b21939e88b54b29f9fb05da9f9e37e87258a4edbd2149f5dd` |
| `private/vsl/protocolo-g.html` | `59b1d47e1c9d7613d1fc30884ce7df78080f9544c730e9435079a0aa39bdfe7b` |
| `public/assets/js/meta-ec-protocolo-g-bridge.js` | `e0904cae1d97ce20b6493aad28b538650ada24c501b38e6a9e382d145e4dccd9` |

Arquivos compartilhados preservados:

| Arquivo | SHA-256 |
|---|---|
| `public/assets/js/tracking-protocolo-g-formulario-20260815.js` | `da4a9415211991cf6669cea2734c1abecc3f516d00f6330c3feb9761ee7839f9` |
| `public/assets/js/pixel.js` | `89449a5822f996725bb8be68058c5363bf62d17a8bb7c7c8ffe0cc306a29937a` |

## Validações concluídas

- CI do PR: Node.js 20, Node.js 22 e Cloudflare Pages aprovados.
- Vitalismen local e candidato Linux: `384/384` testes do `senior:check`.
- Guard V62: `35/35` testes.
- `npm audit --omit=dev` do Vitalismen: zero vulnerabilidades.
- Health público: `online`, sem razões de degradação; Z-API `connected` e
  `outboundBlocked=false`.
- Endpoint V62 rejeitou payload inválido com HTTP `400`, sem persistência.
- Candidato VSL no staging isolado: `25/25` testes V62.
- Regressão da árvore oficial VSL depois da troca: `66/66` testes.
- Guard de escopo VSL e política de segurança: aprovados.
- Auditoria da VSL manteve o snapshot congelado de cinco vulnerabilidades
  `high` transitivas de Puppeteer, zero `moderate` e zero `critical`; nenhuma
  vulnerabilidade nova ou fora da allowlist foi aceita.
- HTML móvel público contém um único player VTurb e o cachebuster V62.
- A CTA antecipada não existe no HTML inicial; é criada dinamicamente e só é
  exibida após o limiar de `720` segundos medidos.
- O endpoint público de configuração manteve o TTL de atribuição em `168`
  horas.

## Preservado

- CTA final e player VTurb;
- número oficial, formulário e mensagem comercial;
- produto, preços, checkout, pedidos e Dropi;
- Dataset, Pixel, eventos Meta/CAPI e Purchase;
- funil WhatsApp, vendedor, mídias, áudios, memória e schedulers;
- demais VSLs do Equador.

Nenhum cliente real recebeu mensagem de validação. Nenhum lead de painel,
pedido, envio Dropi, evento Meta/CAPI ou Purchase foi criado ou reenviado.

## Rollback

Vitalismen: reativar somente a release anterior pelo helper transacional
oficial e conferir `current`, PM2, health e CWD real. VSL: restaurar os três
arquivos pelo backup root-only registrado acima, recarregar somente `cloaker`
e repetir hashes, testes, guards e validação pública móvel.
