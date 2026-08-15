# Hotfix congelado EC v8: produto manual, tabela de precos e sessao Dropi

Data: 2026-08-15

## Origem e autorizacao

Esta camada nasce diretamente da release v5 ativa em producao, commit `b53e575b832e28a970bf9c8165e2513e933c0890`. A solicitacao operacional de 15/08/2026 autorizou corrigir a imposicao indevida de Vit Power/Nitrix sobre pedidos que o operador registrou como Tex Ultra, completar a tabela de precos e restabelecer o envio seguro dos pedidos reais sem duplicacao.

Os freezes v5, v6 e v7 permanecem historicos e nao foram reescritos. Esta v8 e um hotfix paralelo sobre a linha efetivamente publicada; ela nao publica nem incorpora os commits ainda nao ativados de Meta Purchase v2 ou da politica de chamadas.

## Correcao funcional limitada

1. O `productKey` estruturado salvo na ficha da negociacao atual vence mensagens e estados historicos.
2. Historico de conversa passa a ser somente fallback quando a ficha atual nao informa produto.
3. Pacote, `tracking.productKey`, `tracking.productName`, `contentName` e `contentIds` sao sincronizados com a mesma escolha da ficha.
4. A trava Dropi reconhece a origem `manual_customer_draft` e nao impoe Nitrix por uma mencao antiga.
5. Todos os produtos EC recebem a mesma tabela visivel de oito opcoes: quatro originais e quatro promocionais.
6. A sessao autenticada Dropi fica em `~/.vitalismen-secrets/droppi-ec-storage.json`; caminho relativo dentro do release e ignorado para evitar loop de symlink e perda entre releases.

## Preservacao

- Nenhum texto, audio, tempo, fila ou transicao dos funis automaticos foi alterado.
- Nenhuma dependencia foi instalada, removida ou atualizada.
- Nenhum freeze anterior foi modificado.
- A correcao de dados dos sete pedidos e o envio real devem ocorrer somente depois de busca externa sem duplicidade, deploy validado e autorizacao individual pela rota oficial.

## Tabela aprovada

- Original: 1 por USD 39.99; 2 por USD 70.00; 3 por USD 95.99; 6 por USD 167.99.
- Promocional: 1 por USD 35.99; 2 por USD 70.00; 3 por USD 80.99; 6 por USD 147.99.

## Rollback

O rollback operacional consiste em restaurar o symlink para a release v5 `20260815T045340Z_ec_universal_metrics_b53e575` e reiniciar somente o processo `vitalismen-automation`, depois de health check. O rollback de codigo nao apaga nem reescreve pedidos que ja tenham sido enviados ao Dropi.
