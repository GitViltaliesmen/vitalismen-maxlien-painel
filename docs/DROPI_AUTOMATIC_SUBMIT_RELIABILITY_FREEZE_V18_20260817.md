# Freeze V18 — confiabilidade do envio automatico Dropi EC

Data: 2026-08-17

Status: aprovado pelo pedido do operador para varrer o problema e aplicar a solucao sem destruir o bot.

## Evidencia e causa

- El Coca foi criado manualmente no Dropi com Orellana/El Coca, Servientrega e os mesmos dados persistidos pelo bot; ID Dropi `6572837`.
- O erro automatico ocorreu na pagina de login do Dropi, mas um token antigo fez a automacao continuar e informar incorretamente `private catalog product not found`.
- Santa Elena foi criado manualmente com Santa Elena/Santa Elena; ID Dropi `6572798`.
- A tentativa automatica havia aceitado `El Tambo Santa Elena` como correspondencia para `Santa Elena`, levando a cotacao de outra cidade e rejeicao de `CON RECAUDO`.

## Microcamada autorizada

1. Uma pagina de login nunca e considerada autenticada apenas porque ainda existe token no armazenamento do navegador.
2. O login aguarda sair de fato da tela de credenciais ou entrar no segundo fator; token antigo nao encerra a espera.
3. Se o produto redirecionar novamente ao login, o erro e classificado como sessao expirada e recebe somente a repeticao transitoria ja limitada a duas tentativas totais.
4. Correspondencia de cidade deixa de aceitar o nome esperado em qualquer ponto da opcao; qualificadores posteriores continuam compativeis, mas prefixos de outra cidade nao.

## Preservacoes obrigatorias

- Nenhum pedido e reenviado por teste ou guard.
- Nenhuma mensagem, midia, guia ou evento Meta e enviado.
- Tex Ultra continua em USD 35.99/70.00/80.99/147.99 para 1/2/3/6 frascos.
- Produto, quantidade, `CON RECAUDO`, Servientrega e autorizacao humana continuam obrigatorios.
- Deduplicacao, locks, historico anti-spam, scheduler, schema, WhatsApp, funil e memoria nao mudam.
- O pedido Sig Sig final `1264` permanece fora desta correcao operacional enquanto o cliente nao fornecer destino atendido.

## Validacao sem envio

```sh
npm run senior:check
node scripts/audit-ec-product-micro-layer.mjs
npm run guard:ec-dropi-catalog
npm run guard:guide-print-spam
npm run guard:freeze-lock
```

Depois de publicar, conferir `pm2 jlist`, o destino real de `current` e o health publico. Um teste real futuro so pode usar pedido novo autorizado e deve confirmar visualmente cidade, produto e total antes do clique final.
