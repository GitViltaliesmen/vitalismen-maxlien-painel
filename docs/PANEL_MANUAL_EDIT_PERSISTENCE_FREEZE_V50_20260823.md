# Freeze V50 — persistência da edição manual no painel EC

A V50 sucede a V49 e corrige exclusivamente a ficha do cliente no painel
oficial `public/qr.html`, após o operador informar que alterações manuais — em
especial no `customerNameInput` — eram desfeitas pela própria tela.

## Causa confirmada

A recarga de conversas executada a cada 3,5 segundos chamava
`renderSelectedDetails()` e limpava `customerCorrectedFields` mesmo quando a
ficha continuava em edição. O próximo autosave deixava então de declarar o nome
como correção humana; diante do lock V28/V48 anterior, o resolvedor preservava o
valor antigo e o navegador o reaplicava no campo.

Havia ainda duas condições de corrida relacionadas: respostas de autosave
podiam chegar depois de uma digitação mais nova, e o destino do `PATCH` era
recalculado depois de uma espera assíncrona. Ao trocar de cliente durante o
salvamento, uma ficha antiga poderia atingir a chave da seleção nova.

## Alteração autorizada

- A revisão da edição e os campos corrigidos são capturados no início de cada
  salvamento.
- Recargas preservam o rascunho e a marca de correção humana enquanto a ficha
  estiver suja.
- Respostas antigas não escrevem nos inputs, não limpam o rascunho e não mudam
  a ficha selecionada.
- Salvamentos da ficha são serializados; uma falha anterior não interrompe a
  fila seguinte.
- O destino da rota é fixado no contato original antes do primeiro `await`.
- Digitação, atalhos de cópia, imagem aceita pelo operador e seleção manual de
  agência registram a origem humana nos campos V28 aplicáveis.
- Consultas antigas de agência e o retorno da guia manual não substituem uma
  edição mais recente nem redirecionam o operador para outro cliente.

## Preservado

Não foram alterados produto, preço, VSL, funil, áudio, imagem enviada ao
cliente, transporte Z-API, número oficial, pedido, checkout, Dropi, Meta/CAPI,
pixel, banco, scheduler ou PM2. A validação não envia mensagem, não cria pedido
e não edita cliente real.

## Validação e rollback

São obrigatórios o teste V50, os guards V49/V50, `senior:check`, o audit de
microcamada de produto e a validação do painel em navegador com API simulada.
O rollback funcional é a release V49
`/opt/vitalismen-automacao/releases/20260823T231500Z_production-20260823-cbc845b`.
Bancos, mensagens e mídias compartilhados não devem ser removidos no rollback.
