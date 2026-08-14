# EC — 8416 na VSL e retenção do pós-venda do 2800

Data: 12/07/2026

## Regra temporária aprovada

- Todo novo cliente da VSL EC usa exclusivamente o número final `8416`.
- O número final `2800` está fora de VSL, rotação, painel operacional e qualquer tráfego novo.
- O `2800` ficou reservado para possível recuperação de pós-venda quando a conta voltar a ficar conectada.
- Até essa recuperação, o pós-venda automático EC está pausado para que nenhum cliente antigo receba mensagem do remetente `8416` por engano.

## Separação por site

- EC mantém VSL, painel, banco, produto, moeda USD, Dropi e regras próprias.
- CO mantém VSL, painel, banco, produto, moeda, Dropi e regras próprias.
- A instância Z-API do `8416` é o único canal compartilhado temporariamente: o webhook foi apontado ao endpoint EC existente para entradas da VSL; o serviço CO permaneceu ativo para seus avisos pós-venda de saída.
- Não foram copiados dados de clientes, funis, preços, produtos, Pixels, Dropi ou bancos entre os países.

## Camadas aplicadas

- A VSL `https://ec.maxlien.shop/n/` foi sincronizada no webroot público e validada com o final `8416`.
- O backend EC recebeu as credenciais da instância já conectada ao `8416`, sem expor tokens em logs.
- A VSL confirma o número conectado no endpoint Z-API antes de abrir o WhatsApp.
- Venda automática continua desligada: resposta automática, funil, Nitrix Fast State, watchdog e recuperadores comerciais permanecem bloqueados.
- Pós-venda EC temporariamente pausado: recompra, despacho de entrega, retirada e guia estão em `false` até a recuperação deliberada do `2800`.

## Evidência e rollback

- Release EC ativo: `20260712034750_git_3a57348`.
- PM2 `vitalismen-automation` online, apontando para `current`.
- Health EC validado com Z-API conectada e telefone final `8416`.
- Backups VPS criados antes da troca de instância, antes da VSL pública e antes da pausa de pós-venda.
- O último despacho de entrega antes da pausa registrou `Enviados 0/1`; não houve envio ao cliente durante a troca.

## Reabertura do 2800

Somente após a confirmação visual de que o `2800` voltou a ficar conectado no WhatsApp/Z-API, criar uma camada exclusiva de pós-venda para ele. Essa camada não pode colocá-lo na VSL, rotação de vendedores, links públicos ou atendimento de venda.
