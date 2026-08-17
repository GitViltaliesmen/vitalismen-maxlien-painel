# Infraestrutura oficial — MAXLIEN EC / Vitalismen

Atualizado em 2026-08-17.

## Identidade e isolamento

- Projeto: `MAXLIEN EC — VITALISMEN OFICIAL`.
- Dominio: `https://ec.maxlien.shop/`.
- VPS: `72.60.137.77`.
- Aplicacao: `/opt/vitalismen-automacao/current`.
- Processo: `vitalismen-automation` no PM2 do root.
- Banco: `vitalismen_automacao`.
- GitHub: `GitViltaliesmen/vitalismen-maxlien-painel`.
- Branch de producao: `production`.
- Marcador: `.vitalismen-official-root`.

Nao usar projetos, dominios, bancos, numeros, pixels, funis, VPSs ou repositorios fora deste mapa sem pedido explicito do operador.

## Estado ativo confirmado antes da V17

```text
current -> /opt/vitalismen-automacao/releases/20260817T022344Z_production-20260816-e0e2c54
commit  -> e0e2c548be9aeecf076fc5b5ec2a1405f0e0e0e0
tag     -> production-20260816-e0e2c54
```

O processo Node ativo executava `/opt/vitalismen-automacao/current/src/index.js`; Z-API estava conectada e era o transporte oficial. Baileys em `scanning` nao degrada a operacao quando a Z-API esta pronta.

## Entrada publica atual

- `/n/`: Tex Ultra Ecuador.
- `/m/`: Vit Power Ecuador.
- Nitrix: somente entrada explicitamente identificada ou selecao manual controlada.
- WhatsApp publico atual: final `8416`.
- Tabela promocional Tex Ultra: 1 frasco USD 35.99, 2 frascos USD 70.00, 3 frascos USD 80.99 e 6 frascos USD 147.99.

## Camada sucessora

A V17 em `docs/PRODUCTION_SECURITY_PRODUCT_INTEGRITY_FREEZE_V17_20260817.md` protege rotas sensiveis e impede produto real por fallback silencioso. Ela nao altera os valores, o numero, o funil, o scheduler, a memoria ou o contrato de autorizacao Dropi.

## Verificacao operacional

```sh
readlink -f /opt/vitalismen-automacao/current
pm2 jlist
curl -fsS https://ec.maxlien.shop/api/health/
```

No `pm2 jlist`, `vitalismen-automation` precisa ter `pm_cwd` e `pm_exec_path` no release apontado por `current`. O release anterior permanece como rollback e nunca deve ser apagado durante a promocao.
