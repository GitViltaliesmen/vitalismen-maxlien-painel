# Auditoria Tex Ultra EC - 2026-07-24

## Escopo isolado

- Dominio: `ec.maxlien.shop`.
- Painel: `ec.maxlien.shop/qr.html`.
- VSL Nitrix existente: `ec.maxlien.shop/n/`, sem alteracao de conteudo.
- Produto novo: `tex_ultra_ec`.
- Nenhum arquivo, servidor ou fluxo de outro pais faz parte desta revisao.

## Backup anterior as mudancas

- VPS Hostinger: `srv1182009` (`72.60.137.77`).
- Release: `/opt/vitalismen-automacao/releases/20260718T152536Z_ec_hostinger_public_freeze`.
- Commit: `564e81c1c211056944416a1db2605002fa9e6313`.
- Backup VPS: `/root/codex_deploy_backups/ec_audited_tex_ultra_20260724T235708Z`.
- Copia local: `C:/Users/Wolfe/Documents/New project/backups/ec_audited_tex_ultra_20260724T235708Z`.
- Conteudo: site, release completa, SQLite, MongoDB e Nginx.
- Validacao: arquivos compactados legiveis, SQLite `integrity_check=ok` e todos os SHA-256 conferidos no VPS e no computador.

## Implementado na branch isolada

- Registro independente `tex_ultra_ec`.
- Imagem oficial em `public/media/sales/ec/tex_ultra.png`.
- Oferta publica: 1, 3 e 6 frascos.
- Venda operacional aceita: 1, 2, 3 e 6 frascos.
- Valores: USD 35.99, 70.00, 80.99 e 147.99.
- Provas sociais apontadas para a biblioteca compartilhada EC, sem duplicar ou alterar os originais.
- Painel com produto, imagem e tabela de precos proprios.
- Identificacao VSL reservada para `/tex-ultra/`; `/n/` continua Nitrix.
- Dropi bloqueado por padrao ate validacao do produto exato.
- Pos-venda Tex nao usa audios de Vit Power; nomes proprios ficam aguardando os arquivos.

## Bloqueios para ativacao

1. Confirmar URL e nome exato do Tex Ultra no catalogo Dropi EC.
2. Entregar ou aprovar os audios `TEX_ULTRA_INICIO_01` e `TEX_ULTRA_INICIO_02`.
3. Entregar ou aprovar os audios de pos-venda: agradecimento, modo de uso e tempo de resultado.
4. Entregar ou aprovar a apresentacao/VSL Tex Ultra para publicar em `/tex-ultra/`.
5. Renovar a sessao/2FA do Dropi e executar um pedido de teste controlado, sem envio real.
6. Corrigir os bloqueios preexistentes do `senior:check` sem apagar historico operacional.
7. Executar teste visual do painel e teste ponta a ponta em telefone de QA.
8. Obter aprovacao final antes de publicar ou reiniciar a producao.

## Validacoes executadas

- `npm run guard:ec-tex-ultra`: OK.
- `npm run guard:ec-product-micro-layer`: OK.
- `npm run audit:no-regression`: OK.
- Sintaxe Node dos arquivos alterados: OK.
- `git diff --check`: OK.
- `npm run senior:check`: bloqueado por dados/documentos antigos e pela regra de caminho oficial da release; nenhuma falha nova de Tex Ultra foi apontada.
