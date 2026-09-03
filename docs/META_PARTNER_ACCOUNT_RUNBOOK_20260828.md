# Runbook — adicionar conta de anúncio parceira sem refazer Pixel/CAPI

Data: 2026-08-28.

## Decisão correta

Na operação comum, uma nova agência ou conta de anúncio parceira deve receber
acesso ao Dataset/Pixel já usado pelo site. Não se troca o ID no HTML, não se
troca o CAPI, não se cria um segundo Purchase e não se reinicia o servidor.

Use este quadro antes de qualquer ação:

| Necessidade | Operação | Código/site | Reinício |
| --- | --- | --- | --- |
| Agência/parceiro vai anunciar o mesmo produto/site | Compartilhar Dataset existente | Nenhuma | Não |
| Conta de anúncio da empresa precisa usar o mesmo histórico | Atribuir a conta ao Dataset existente | Nenhuma | Não |
| Dataset foi comprometido ou a empresa decidiu migrar de propriedade | Perfil inativo + ativação atômica | Registry compartilhado | Não |
| “Criar outro Pixel para o parceiro” | Bloqueado | Não fazer | Não |

## Dados que o parceiro precisa fornecer

- Business ID do portfólio empresarial parceiro;
- ID numérico da conta de anúncio parceira;
- nome jurídico/operacional da agência;
- responsável que aceitará o acesso;
- confirmação escrita de que usará o Dataset existente e não instalará outro
  Pixel ou Purchase.

Não pedir nem receber a senha pessoal do parceiro. Não compartilhar token CAPI.

## Gerar o plano auditável

No VPS oficial, o comando é somente leitura:

```sh
cd /opt/vitalismen-automacao/current
node scripts/manage-meta-destinations-v73.mjs plan-partner \
  --business-id=BUSINESS_ID_NUMERICO \
  --ad-account-id=AD_ACCOUNT_ID_NUMERICO
```

O resultado esperado informa:

- `mode=SHARE_EXISTING_DATASET_WITH_PARTNER`;
- `runtimeChangeRequired=false`;
- `siteRestartRequired=false`;
- `profile` igual ao perfil atualmente ativo da rota;
- Dataset EC principal `1468946114265008` enquanto esse for o perfil ativo.

O perfil não deve ser fixado manualmente no uso comum: o helper deriva o ativo
do registry. Se `--profile` for informado para auditoria, ele precisa coincidir
com o ativo; perfil antigo/inativo é recusado. O comando não acessa a Meta, não
altera arquivos e não dispara eventos.

## Passos no Meta Business Settings

Os nomes de menus podem variar entre “Fontes de dados”, “Datasets” e “Pixels”.
Executar com um administrador do portfólio que possui o Dataset:

1. Abrir Configurações do negócio/portfólio oficial EC.
2. Localizar o Dataset/Pixel do perfil ativo pelo ID exato exibido no plano.
3. Usar **Atribuir parceiro** ou **Adicionar parceiro** e informar o Business ID
   recebido.
4. Conceder apenas as permissões necessárias para anunciar e visualizar os
   eventos; não transferir propriedade.
5. No portfólio parceiro, atribuir a conta de anúncio informada ao mesmo
   Dataset.
6. Confirmar que a campanha usa o domínio oficial `ec.maxlien.shop` e o Dataset
   compartilhado, sem instalar outra tag.

Se a interface não oferecer parceiro, confirmar primeiro a propriedade do
Dataset e o nível de controle do operador. Não contornar criando outro Pixel.

## Validação sem conversão falsa

1. Conferir o destino público atual:

   ```sh
   curl -fsS https://ec.maxlien.shop/api/health/meta-destination
   ```

2. Conferir o registry redigido:

   ```sh
   cd /opt/vitalismen-automacao/current
   node scripts/manage-meta-destinations-v73.mjs status
   ```

3. Verificar que `datasetId === browserPixelId`, `available=true` e que nenhum
   token aparece; registry e secrets devem permanecer `root:root 0600`.
4. No Events Manager, confirmar que o parceiro vê a fonte de dados existente e
   seu histórico. Não reenviar Purchase antigo.
5. Quando a operação sair legitimamente de `STRICT_READ_ONLY`, verificar um
   evento real novo e sua deduplicação pelo mesmo `event_id`; não fabricar
   pedido nem usar telefone de cliente.

Enquanto o runtime estiver em `STRICT_READ_ONLY`, rotas POST server-side
continuam bloqueadas. O compartilhamento pode ser preparado, mas a ausência de
CAPI novo nesse modo é esperada e não autoriza desligar a trava.

## Troca real de Dataset — exceção

Somente quando houver decisão explícita de migração:

1. guardar o novo token em uma chave nova, nunca substituir a chave ativa;
2. criar um perfil novo e inativo com `upsert-profile`;
3. garantir que `datasetId` e `browserPixelId` sejam iguais;
4. validar domínio, permissões e resolvedor Browser;
5. confirmar que não existem pedidos atribuídos ainda abertos cuja conversão
   deva permanecer no Dataset anterior; a V73 não reenvia nem migra Purchase
   histórico;
6. executar `activate-profile` declarando o perfil ativo e o Dataset de destino
   esperados, primeiro em DRY RUN e depois com o gate efêmero e `--apply`;
7. verificar imediatamente o endpoint público e o status redigido;
8. manter o perfil anterior e seu token por pelo menos seis horas para as
   sessões já abertas concluírem com o binding original e para rollback.

Exemplo de perfil em DRY RUN:

```sh
node scripts/manage-meta-destinations-v73.mjs upsert-profile \
  --profile=ec-primary-next \
  --route=country_ec_default \
  --dataset-id=NOVO_DATASET_NUMERICO \
  --browser-pixel-id=NOVO_DATASET_NUMERICO \
  --token-refs=secret:ec_primary_next \
  --browser-verified-at=TIMESTAMP_ISO
```

Sem `--apply`, nada é escrito. Perfil ativo é imutável e o helper bloqueia
ativação sem token.

Exemplo de ativação em DRY RUN, protegido contra estado obsoleto ou Dataset
digitado incorretamente:

```sh
node scripts/manage-meta-destinations-v73.mjs activate-profile \
  --route=country_ec_default \
  --profile=ec-primary-next \
  --expected-current-profile=ec-primary \
  --expected-next-dataset-id=NOVO_DATASET_NUMERICO
```

Somente depois de conferir a saída, repetir com `--apply` e com o gate efêmero
exato. Se o perfil ativo tiver mudado desde o plano, o helper bloqueia a troca.
Se houver `.meta-destination-change.lock`, não apagar automaticamente: confirmar
se existe processo em execução e auditar o conteúdo/timestamp antes de remover
um lock comprovadamente órfão.

## Rollback

- Parceiro: remover a permissão do Business ID parceiro no Dataset.
- Conta de anúncio: remover a atribuição da conta ao Dataset.
- Migração real: reativar o perfil anterior pelo helper.
- Nunca restaurar HTML antigo, nunca recolocar Pixel fixo e nunca reemitir
  Purchase para “testar”.
