# Congelado - VSL CTA Restaurado

Data: 2026-05-27

## Pagina

- `https://ec.maxlien.shop/m/`
- Arquivo vivo no VPS:
  - `/var/www/ec.maxlien.shop/m/index.html`

## Problema corrigido

O CTA nativo da VSL podia ser detectado e escondido para evitar duplicidade, mas o CTA/formulario proprio da pagina nao era exibido imediatamente no lugar.

Isso podia dar a impressao de que o CTA saiu da pagina.

## Correcao aplicada

Quando a pagina detectar um CTA externo/nativo da VSL:

- mostra imediatamente o formulario/CTA proprio da pagina
- preserva o botao principal `Abrir WhatsApp`
- esconde o CTA duplicado nativo para evitar dois chamados concorrendo
- mantem o timer original de 40 minutos como fallback
- mantem `?showForm=1` como modo de teste seguro

## Validacao

- `https://ec.maxlien.shop/m/?showForm=1` exibiu o formulario.
- Botao `Abrir WhatsApp` ficou visivel.
- Com nome preenchido, o clique abriu WhatsApp para o numero oficial:
  - `5515991418416`
- A mensagem enviada ao WhatsApp manteve:
  - frase oficial de CTA
  - `Nombre completo`
- A abertura normal em desktop continuou preservando a pagina informativa.

## Backup

- `/var/www/ec.maxlien.shop/m/index.html.bak.restore_cta_20260528-005537`

## Escopo

Nao foi alterado:

- Observacao congelada
- painel de atendimento
- Leads Clientes
- Dropi
- planilhas
- historico de clientes
- API do funil

## Status

Congelado no VPS.
