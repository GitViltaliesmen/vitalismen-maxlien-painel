# 8416 compartilhado — roteador por país, sem mistura de dados

Data: 12/07/2026

## Objetivo

Manter o telefone final `8416` como canal temporariamente compartilhado, preservando os dois sites e seus dados separados.

## Regra de roteamento

- Cliente com DDI `+593`: o webhook é processado somente pelo backend EC.
- Cliente com DDI `+57`: o webhook é encaminhado ao endpoint Z-API já existente do backend CO.
- O backend EC não cria `ContactState`, mensagem, pedido ou funil para eventos CO encaminhados.
- Se o encaminhamento CO falhar, o EC responde erro ao provedor em vez de gravar o evento CO no EC.
- Eventos sem DDI de cliente continuam no EC apenas como eventos técnicos; não carregam cliente, pedido ou funil entre países.

## Isolamento preservado

- EC: VSL, painel, Mongo, produto, USD, Dropi, Meta e regras EC.
- CO: VSL, painel, dados locais, produto, moeda, Dropi, Meta e regras CO.
- O único item compartilhado é a instância/remetente Z-API `8416` por decisão operacional temporária.
- Nenhum código, preço, mídia, pedido ou cliente CO foi copiado ao EC, e nenhum item EC foi copiado ao CO.

## Estado operacional EC

- VSL pública EC validada no `8416`; sem referência ao `2800`.
- Venda automática EC continua desligada.
- Pós-venda automático EC continua em retenção enquanto o `2800` está indisponível.
- O serviço CO permaneceu ativo e alcançável para receber os eventos `+57` encaminhados.

## Evidência

- Commit de código: `d711c7e`.
- Release EC ativo: `20260712141903_git_d711c7e`.
- Health EC: Z-API conectada no final `8416`, fila de entrada vazia.
- Conectividade EC → endpoint CO validada por `GET /api/health` com HTTP `204`.
- Teste unitário do classificador cobriu entrada e confirmação de entrega para `+593` e `+57`; nenhum cliente sintético foi criado.
- Backup VPS antes da camada: `ec-pre-zapi-country-router-20260712T141904Z.tar.gz`.

## Regra de alteração

Para remover o compartilhamento, criar uma camada nova: escolher qual país ficará com a instância, atualizar o webhook da Z-API e validar os dois painéis antes de desligar o encaminhamento.
