# Congelamento - Recuperacao de Frios e Kit Medio

Data: 2026-05-27

## Estado aprovado

Camada adicionada ao modulo Observacao para analisar, sem executar automaticamente:

- clientes frios ou abandonados;
- quando sugerir bonus reservado;
- quando sugerir promocao relampago discreta;
- quando nao sugerir promocao e mandar para suporte pos-venda;
- candidatos para aumentar kit medio;
- ticket medio e media de unidades por pedido.

## Estrategia adotada

O relatorio separa os casos em:

- `flash_promo`: lead frio/morno sem fechamento, candidato a promocao curta e discreta;
- `buy_later_bonus`: cliente adiou compra, candidato a bonus reservado e data combinada;
- `trust_recovery`: cliente esfriou por medo de golpe/saude, precisa prova e audio antes de oferta;
- `soft_reminder`: cliente parou no meio do fluxo, precisa lembrete curto;
- `post_sale_support`: cliente parece estar em pos-venda, guia, bonus, agencia ou pedido. Nao sugerir promocao;
- `human_review`: sinal pouco claro, revisar manualmente.

## Kit medio

A camada calcula:

- media de unidades por pedido;
- ticket medio;
- distribuicao por quantidade;
- candidatos de 1 frasco para sugestao de 3 frascos.

Regra comercial: aumentar kit medio deve priorizar valor percebido, tratamento completo, economia por frasco, bonus e seguranca. Evitar desconto cedo demais.

## Validacao real no VPS

Relatorio gerado:

- id: `6a178a7565e94e9f40e024e0`
- candidatos de recuperacao exibidos: 30
- `flash_promo`: 22
- `human_review`: 6
- `post_sale_support`: 2
- `buy_later_bonus`: 0 na janela analisada
- kit medio: 0 na janela de 24h porque nao havia pedido confirmado no periodo

## Seguranca

Nada e enviado automaticamente.

Esta camada apenas recomenda. Qualquer envio de bonus, promocao relampago ou tentativa de upgrade de kit precisa de aprovacao humana ou de uma camada futura aprovada.

## Backup VPS

- `/opt/vitalismen-automacao/backups/observacao-recuperacao-kit-medio-20260527-211947`
- `/opt/vitalismen-automacao/backups/observacao-recuperacao-kit-medio-ajuste-20260527-212046`
