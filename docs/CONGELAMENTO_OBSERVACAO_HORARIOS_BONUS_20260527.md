# Congelamento - Observacao de Horarios e Bonus

Data: 2026-05-27

## Estado aprovado

Camada adicional do modulo Observacao para mapear:

- horarios quentes de venda;
- volume de mensagens por hora;
- leads por hora;
- pedidos confirmados por hora;
- retiradas/entregas por hora;
- efeito correlacional do bonus de retirada;
- clientes elegiveis que ficaram sem bonus registrado.

## Seguranca

Esta camada continua sendo somente leitura.

Nao envia bonus automaticamente, nao altera pedido, nao altera status, nao mexe em Dropi e nao envia mensagem para cliente.

## Validacao real no VPS

Relatorio de teste gerado:

- id: `6a17883895783a62a8c121ab`
- janela: ultimas 24h
- criticos: 4
- importantes: 19
- comprar depois: 4
- sinais medicos: 5
- perguntas sem resposta: 14

## Horarios quentes detectados na validacao

- 19:00: 1 retirado/entregue, 1 lead, 29 mensagens
- 10:00: 3 leads, 28 mensagens
- 21:00: 1 lead, 23 mensagens

Esses horarios sao indicadores iniciais e devem ser reavaliados com mais volume de trafego pago.

## Bonus de retirada

Na validacao foi detectado 1 cliente elegivel sem bonus registrado:

- `EC-DROPI-5516408`
- Fredy Camacho de Alberto Hernandez
- telefone: `939514479`
- cidade: DURAN
- status: ENTREGADO

O modulo apenas aponta a falta. Envio do bonus deve continuar por aprovacao humana ou fluxo ja aprovado.

## Backup VPS

- `/opt/vitalismen-automacao/backups/observacao-horarios-bonus-20260527-211106`
