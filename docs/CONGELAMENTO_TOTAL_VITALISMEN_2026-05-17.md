# Congelamento Total Vitalismen - 2026-05-17

Status: aprovado/congelado pelo operador.

Este documento congela o estado atual do painel e automacao Vitalismen. Qualquer alteracao futura deve preservar estes pontos, salvo pedido explicito do operador para mexer exatamente no item.

## Itens Congelados

- Painel integrado Vitalismen em `public/qr.html`.
- Tela de atendimento estilo WhatsApp, incluindo lista de conversas, conversa central, rodape de mensagem, anexos, audio com ondas reais, imagem e video.
- Foto da atendente Ana Lopez antes das mensagens comerciais.
- Regras de midia: audio e imagem devem renderizar como midia real no painel, nao como referencia interna.
- Filtro operacional EC: clientes do Equador devem entrar apenas como telefones validos `593`; Brasil fica liberado somente para teste, nunca para envio Dropi.
- Bloqueio de grupos, status, broadcast e IDs tecnicos sem telefone real como clientes.
- Revezamento de numeros e limite operacional atual, com o numero `553183002800` liberado para atender hoje.
- Processo Dropi Ecuador:
  - pedido precisa ser autorizado antes de envio;
  - evitar duplicidade;
  - nao enviar numero brasileiro para Dropi;
  - aceitar saldo novo sem prender pedido em credito antigo;
  - considerar pedido enviado quando a API Dropi retornar ID;
  - retry curto para falha transitoria de navegador/conexao;
  - produto oficial `VIT POWERS 1000ML COMUNIDAD` com aliases tolerantes;
  - correcao de cidade/provincia para casos como Portovelo e Santo Domingo.
- Funil Vit Power aprovado, sem mistura com fluxos do Micael ou projetos antigos.
- Memoria do cliente: nao reiniciar conversa do zero quando cliente antigo manda nova mensagem.
- Ficha do cliente e dados de pedido sincronizados com painel unificado e status.
- Botoes do formulario no rodape: `Salvar ficha`, `Enviar pedido Dropi`, `Comprar depois`.

## Regra Dura

Nao alterar, remover, reordenar, simplificar ou refazer os itens acima sem pedido explicito do operador.

Antes de qualquer mudanca futura em WhatsApp, Dropi, funil, pedidos confirmados, midia, audio, imagens, numeros ou painel:

1. Ler este documento.
2. Ler `AGENTS.md`.
3. Conferir o diff congelado em `approved_freezes/diff_congelamento_total_vitalismen_20260517_021215.patch`.
4. Fazer a menor alteracao possivel.
5. Validar no painel online antes de encerrar.

## Validacao Atual

- Dropi logada no VPS com token valido.
- Saldo Dropi conferido em 2026-05-17: `$ 562,21`.
- Nenhum pedido preso como `dropi_payment_required` no momento do congelamento.
- Servicos online no VPS: `vitalismen-automation`, `sync-dropi-ec`, `push-dropi-orders`.

