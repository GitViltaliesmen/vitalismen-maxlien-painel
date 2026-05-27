# Bot de Observacao - Auditoria do Funil Vit Power EC

Data: 2026-05-27

## Objetivo

Criar uma camada de observacao para analisar historicos reais de conversa e apontar falhas de conversao, sem alterar a camada congelada de atendimento, Dropi, Leads Clientes ou Comprar Depois.

Esta camada deve gerar saida acionavel. Ela nao deve apenas dizer que "o bot esta frio"; ela deve mostrar:

- qual frase do cliente quebrou a venda;
- qual resposta do bot deve ser substituida;
- onde entra audio humano;
- onde entra prova social;
- quando parar a conversa;
- quando marcar `comprar_depois`;
- quando marcar `cancelado`;
- quando chamar humano.

## Regra principal de conversao

Quando o cliente demonstrar vergonha, medo de golpe ou duvida medica, o bot deve responder primeiro a objecao e so depois pedir dados.

Motivo: pedir dados antes de acolher a objecao faz o atendimento parecer vendedor automatico empurrando pedido. Para homens 40+, isso aumenta vergonha, defensividade e abandono.

## Regra de tom

O bot de observacao deve sugerir respostas:

- curtas;
- humanas;
- discretas;
- sem expor a dor masculina;
- sem promessa medica absoluta;
- sem pressa agressiva;
- com proximo passo claro.

## Prioridade de analise

Ao auditar uma conversa, classificar cada falha em:

- falha critica: pode perder venda imediatamente;
- falha importante: reduz confianca ou cria duvida;
- melhoria: refinamento de copy, ritmo ou ordem.

## Saida esperada da auditoria

Para cada problema encontrado, retornar:

- frase original do cliente;
- resposta atual do bot;
- por que a resposta pode perder venda;
- nova resposta sugerida;
- audio recomendado, se existir;
- prova social recomendada, se existir;
- status recomendado no painel;
- se deve continuar automatico ou chamar humano.

## Limite operacional

Esta camada e apenas de observacao e recomendacao.

Nao deve:

- enviar mensagem ao cliente;
- alterar status automaticamente;
- enviar Dropi;
- mexer em planilhas;
- trocar textos congelados sem nova aprovacao;
- liberar trafego fora do piloto.
