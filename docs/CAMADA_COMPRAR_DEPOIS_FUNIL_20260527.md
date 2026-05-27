# Camada Comprar Depois - Funil Vit Power EC

Data: 2026-05-27.

## Objetivo

Adicionar uma camada lateral ao funil oficial para impedir que clientes com intenção de compra futura, falta de dinheiro ou pedido de cancelamento sejam tratados como pedido confirmado.

Esta camada nao altera a ordem congelada do funil A/B. Ela apenas observa a mensagem recebida antes do fechamento e registra o proximo passo.

## Regras aprovadas

### Comprar depois com data

Gatilhos:

- `fin de mes`, `fin del mes`, `final de mes`
- `proximo mes`
- `quincena`
- `primera semana`, `segunda semana`
- datas explicitas como `para el 12 de junio`, `el 30 de mayo`, `primero de junio`

Acao:

- marcar `purchaseIntent.readiness = buy_later`;
- gravar `purchaseIntent.desiredPurchaseTiming`;
- calcular `purchaseIntent.followUpAt`;
- sincronizar Leads Clientes como `comprar_depois`;
- o painel mostra aviso 3 dias antes da data provavel;
- nao confirmar pedido automaticamente;
- nao enviar para Dropi.

### Comprar depois sem data / sem dinheiro

Gatilhos:

- `estoy chiro`, `ahorita estoy chiro`
- `no tengo plata`, `no tengo dinero`
- `aun no me pagan`
- `cuando tenga el dinero`
- `yo le aviso`, `le aviso despues`, `mañana conversamos`, `mas tarde`

Resposta:

`Entiendo, señor. No se preocupe. Guarde mi número como Ana Lopez - Vit Power y cuando ya desee el producto me escribe por aquí. Si quiere, también puedo dejar anotada una fecha aproximada para recordarle sin molestarlo.`

Acao:

- marcar `comprar_depois`;
- se nao houver data, pedir data aproximada;
- salvar frase original em memoria/observacao;
- nao confirmar pedido automaticamente;
- nao enviar para Dropi.

### Cancelamento / nao enviar

Gatilhos:

- `no me mande`, `no me manden`
- `no envie`, `no despache`
- `ya no quiero`
- `no voy a comprar`
- `cancelar`, `cancele`, `anular`

Acao:

- marcar pedido/lead como `cancelado` quando houver pedido relacionado;
- registrar motivo;
- responder curto confirmando que nao sera enviado;
- pausar o fluxo de fechamento para evitar pedido indevido.

## Proxima camada

Objeções de confianca devem ficar em camada separada:

- `estafa`, `estafadores`
- `garantia`
- `si no me sirve`
- `contra quien me voy`
- `devuelve el dinero`
- `puro bla bla`

Essa camada deve usar provas sociais alternadas, audios aprovados e memoria anti-repeticao, sem repetir mesma prova/texto/audio.
