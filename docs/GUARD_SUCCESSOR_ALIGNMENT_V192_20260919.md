# V192 — alinhamento de guards sucessores

Data: 2026-09-19

## Objetivo

A V192 é uma camada exclusiva de governança. Ela apresenta aos guards históricos a linhagem sucessora já congelada no release ativo, sem alterar runtime, VSL, bot, painel, Meta/CAPI, Z-API, Dropi, produtos, preços ou pós-venda V188.

Base exata: `c0cca110a87c82044db413934c7f017c23a9cfca` (`20260919T011423Z_production-20260919-c0cca11`).

## Arquitetura

- `ec-runtime-successor-v192-context.mjs` carrega o bootstrap canônico existente e adiciona somente três overrides explicitamente validados.
- `run-with-v192-context.mjs` aceita apenas uma lista finita de gates e propaga o preload com o contexto shadow oficial V152-B.
- `audit-ec-nx-funnel-click-path-v192.mjs` substitui a dependência de texto visual histórico por provas do comportamento atual.
- O guard V192 exige que o diff contra a base contenha somente arquivos novos V192 e verifica hashes de todas as superfícies operacionais congeladas.
- Nenhum guard ancestral ou manifesto ancestral é modificado.

## Linhagem autorizada

| Caminho | SHA-256 atual | Fonte sucessora | Motivo |
|---|---|---|---|
| `.github/workflows/ec-panel-quality.yml` | `abe7214a834a61d1cd6626f0b18ebb9d2944397c5d7e7861a5fcbf2572764ab2` | V171 | workflow atual já congelado |
| `src/routes/zapi.js` | `173f73bf3aae4c86f46b25fba9e6c2d567d25061e87bd772c35491c979f16ec6` | V171 | sucessor legítimo do transporte Z-API |
| `src/routes/whatsapp.js` | `48900c53f38cf244a20d7917b397ba6ffdf1b70e66ba36fe7822905564ff6e6b` | V185 | hash lock sucessor atual |

Não há wildcard, regex ampla ou diretório inteiro na lista V192.

## Contrato NX atual

O auditor sucessor comprova sem exigir o rótulo histórico `Finalizar por WhatsApp`:

- botão final `btnSubmit` operacional;
- clique ligado ao envio do formulário;
- resolução do `sellerPhone`;
- destino HTTPS oficial do WhatsApp e deep link `whatsapp://`;
- fallback manual do link;
- medição de CTA visível e clique WhatsApp;
- telefone opcional com validador EC preservado;
- função de submit sem bloqueio condicional.

O arquivo `public/n/index.html` não é alterado.

## Execução dos gates

```sh
node scripts/run-with-v192-context.mjs npm run senior:check
node scripts/run-with-v192-context.mjs node scripts/guard-meta-ec-protocolo-g-attribution-v61.mjs
node scripts/run-with-v192-context.mjs node scripts/guard-protocolo-g-conversion-v62.mjs
node scripts/run-with-v192-context.mjs node scripts/guard-protocolo-g-ad-metrics-v63.mjs
node scripts/run-with-v192-context.mjs node scripts/audit-ec-nx-funnel-click-path-v192.mjs
node scripts/run-with-v192-context.mjs node --test tests/v192-guard-successor-alignment.test.mjs
node scripts/run-with-v192-context.mjs node scripts/guard-v192-successor-alignment.mjs
```

## Segurança e rollback

A V192 não é carregada pelo processo de produção. O runner só opera quando chamado explicitamente em validação local. Rollback consiste em remover o commit V192; nenhum rollback operacional é necessário porque não há deploy, restart, alteração de `.env` ou escrita externa.

## Estado de validação

Todos os gates obrigatórios passaram no worktree V192 com o contexto sucessor explicitamente carregado:

| Gate | Resultado |
|---|---|
| `npm run senior:check` | PASS; baterias de 43, 482 e 22 testes aprovadas (547 no total), além dos guards encadeados |
| Guard V61 | PASS |
| Guard V62 | PASS |
| Guard V63 | PASS |
| Auditor NX V192 | PASS |
| Testes V192 | PASS, 10/10, incluindo oito exigências negativas |
| Guard V192 | PASS |

O guard V192 confirmou diferença zero em VSL, bot/núcleo comercial, painel QR, métricas do funil, pós-venda V188, Meta/CAPI funcional, runtime Z-API, runtime WhatsApp e produto/preço.

Não houve stage, deploy, ativação, restart, mudança de `.env` ou alteração de produção.
