# Congelamento - Status WhatsApp e Google Contatos - 2026-08-02

## Camada aprovada

- A extensao oficial mostra o status operacional diretamente na lista do WhatsApp Web.
- A fonte automatica segue a prioridade: logistica, pedido e ficha; ajuste manual visual fica acima e e auditado.
- Ajuste manual altera somente a etiqueta. Nao altera pedido, Dropi, transporte, Purchase, funil ou pos-venda.
- Estados oficiais: Atendendo, Comprar depois, Confirmado, Enviado, Em rota, Na agencia, Entregue, Devolvido e Cancelado.
- Cache local conserva a ultima leitura em falha de rede e marca o selo como desatualizado.
- Nome duplicado sem telefone identificavel nunca recebe etiqueta por aproximacao.

## Google Contatos

- Somente pedido real EC confirmado depois de `enabledAt` pode entrar na fila.
- Tex Ultra, Nitrix e Vit Power usam a mesma camada lateral, sem misturar seus funis.
- Telefone e a chave unica; a fila possui lock persistido e processa um contato por vez.
- Token offline fica cifrado na VPS com AES-256-GCM; a extensao nunca recebe o token.
- Contato existente com nome diferente vira conflito e nao e sobrescrito automaticamente.
- Alteracao de nome exige confirmacao manual de administrador na extensao.
- Nao existe importacao historica automatica.
- Esta camada nao envia nenhuma mensagem de WhatsApp.

## Ativacao segura

1. Manter o proxy Nginx versionado em `ops/nginx/ec.maxlien.shop-api-integrations.conf` ativo no servidor HTTPS.
2. Configurar na VPS `GOOGLE_CONTACTS_CLIENT_ID`, `GOOGLE_CONTACTS_CLIENT_SECRET` e uma chave aleatoria forte em `GOOGLE_CONTACTS_TOKEN_ENCRYPTION_KEY`.
3. Registrar o callback `https://ec.maxlien.shop/api/integrations/google-contacts/callback` no Google Cloud e habilitar People API.
4. Conectar a conta pelo botao administrativo da extensao.
5. Confirmar um pedido piloto novo e verificar o contato no Google/telefone.
6. Nunca retroagir `enabledAt` nem importar historico sem nova autorizacao.

## Guard obrigatorio

```sh
npm run guard:whatsapp-status-contacts
```

O guard confirma a versao da extensao, endpoints, allowlists, criptografia, cadencia, escopo EC e ausencia de qualquer disparo ou Dropi nesta camada.
