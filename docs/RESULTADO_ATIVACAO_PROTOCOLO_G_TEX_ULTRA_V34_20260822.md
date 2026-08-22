# Resultado da ativação V34 — Protocolo G abre Tex Ultra

## Resultado

- VSL pública: `https://vilaliemen.shop/protocolo-g`.
- Mensagem pública confirmada: `Hola, quiero el tratamiento Tex Ultra.`
- Número oficial preservado: `5515991418416`.
- Pixel legado Vit Power preservado; ele não participa da escolha comercial.
- Dashboard: novos clientes do Protocolo G recebem `tex_ultra_ec` como produto
  de origem e produto inicial da negociação.
- Troca manual no seletor continua limitada à ficha daquele cliente e não
  reescreve `vslProductKey`.

## Git e release

- PR: `https://github.com/GitViltaliesmen/vitalismen-maxlien-painel/pull/28`.
- Commit de produção: `b50a86bb682eae779db1c93e94e1a9b58014cf6e`.
- Tag: `production-20260822-b50a86b`.
- Release ativa:
  `/opt/vitalismen-automacao/releases/20260822T002400Z_production-20260822-b50a86b`.
- Ativação concluída em `2026-08-22T00:22:28Z` pelo helper transacional
  oficial.
- Release de rollback preservada:
  `/opt/vitalismen-automacao/releases/20260821T225331Z_production-20260821-cb8f6fe`.
- Permit root `0600` consumido após um único uso; rollback não executado.

## Backup da VSL

- Backup anterior à correção pública:
  `/opt/cloaker/.backups/protocolo-g/20260822T000257Z-tex-ultra-message`.
- HTML antes:
  `ad12e8e7cd8f5b168543222e74012577c933903a528e4c385e656acba913466c`.
- HTML depois:
  `5db8590e5187cb3704f8bf2af11599c0a521d1858a799a7cca9c0afb95dbf6f7`.
- JavaScript antes:
  `305d2f2ca0751a6731a869a138a9eb4861b845a5186197fc25e82de68afac373`.
- JavaScript depois:
  `da4a9415211991cf6669cea2734c1abecc3f516d00f6330c3feb9761ee7839f9`.

## Validação

- GitHub Actions: Node 20, Node 22 e Cloudflare Pages aprovados.
- Suíte completa no release: `257/257` testes aprovados.
- `SENIOR-GUARD`: OK com o `.env` oficial.
- Guards de microcamada EC, catálogo Dropi, retirada, contatos, freeze lock e
  V34: OK.
- Health local: HTTP 200.
- Health público: HTTP 200.
- Painel público `/n/`: HTTP 200.
- PM2 `vitalismen-automation`: `online`, PID após ativação `2068850`, com
  `pm_cwd=/opt/vitalismen-automacao/current` e
  `pm_exec_path=/opt/vitalismen-automacao/current/src/index.js`.
- VSL pública reconsultada após a ativação: versão
  `20260822-tex-ultra-message`, texto Tex Ultra e número oficial corretos.

Nenhuma mensagem WhatsApp, pedido, chamada Dropi ou evento Meta/CAPI foi
gerado por esta ativação.

## Qualidade dos dados

O bloco V28 foi preservado. O score é um resumo visual; bloqueadores como
modalidade de entrega, endereço ou agência ausentes continuam impedindo pedido,
Dropi e Purchase. Portanto, `85/100` com entrega faltante permanece corretamente
bloqueado.
