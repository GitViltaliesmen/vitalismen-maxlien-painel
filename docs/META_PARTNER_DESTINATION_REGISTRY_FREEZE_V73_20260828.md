# V73 — registro único de destinos Meta e contas parceiras

Data: 2026-08-28.

Escopo exclusivo: MAXLIEN/Vitalismen Ecuador, domínio oficial
`https://ec.maxlien.shop`, VPS Hostinger oficial e repositório oficial EC.

## Objetivo

Eliminar a troca manual e divergente de Pixel entre HTML, `.env` e CAPI. A V73
cria uma fonte única para o Browser Pixel e o Dataset usado pelo servidor e
separa duas operações que não podem ser confundidas:

1. **Adicionar uma conta de anúncio parceira:** compartilhar o Dataset já
   existente no Meta Business Settings. Não muda código, Pixel, token, runtime
   ou PM2.
2. **Trocar realmente o Dataset/Pixel:** criar um perfil inativo completo e
   ativá-lo em uma única substituição atômica, somente depois de validar o
   token e a igualdade Browser/CAPI.

Criar um Pixel paralelo apenas para a conta parceira é proibido: isso rompe a
atribuição histórica e pode duplicar `Purchase`.

## Estado herdado e preservado

- A recuperação operacional V72 permanece a base imutável.
- `FREEZE_VERSION=72` e `DEPLOY_HELPER_CONTRACT_VERSION=72` continuam sendo o
  envelope do helper instalado.
- A política runtime continua V71 `STRICT_READ_ONLY`.
- `DATA_COMPATIBILITY_VERSION=66`; a V73 não cria coleção, migration ou escrita
  de banco.
- O Dataset EC principal existente é `1468946114265008`.
- O Dataset dedicado do Tex Ultra Protocolo G permanece congelado em
  `2048099902484149`.
- Funil, preços, checkout, WhatsApp, Dropi, Meta `event_id`, regras de Purchase
  e deduplicação não são alterados.

## Fonte única fora da release

Configuração operacional sem tokens, arquivo `root:root 0600`:

```text
/opt/vitalismen-automacao/shared/config/meta-destinations.json
```

Segredos opcionais, fora do Git e também obrigatoriamente `root:root 0600`:

```text
/opt/vitalismen-automacao/shared/secrets/meta-destinations.json
```

O serviço relê o registry em cada resolução. Por isso, uma ativação válida não
exige editar a release nem reiniciar o site. Se o arquivo compartilhado ainda
não existir, o contrato legado de `META_PIXEL_ID_EC` e
`META_ACCESS_TOKEN_EC` permanece byte-compatível.

Quando o registry existe, erro de JSON, campo não reconhecido, symlink, caminho
relativo, tamanho inseguro, permissão diferente de `0600` ou owner diferente de
`root:root` em qualquer um dos dois arquivos no runtime root, perfil ausente,
token ausente, Dataset inválido ou divergência Browser/CAPI bloqueia o destino.
Não existe fallback silencioso ao Pixel antigo.

## Contrato do perfil

Cada perfil contém apenas:

- chave estável;
- label operacional;
- rota (`country_ec_default` ou `ec_tex_ultra_protocolo_g`);
- `datasetId`;
- `browserPixelId` obrigatoriamente igual ao `datasetId`;
- referências de token `env:NOME_DA_VARIAVEL` ou `secret:chave_local`;
- timestamp ISO da verificação do resolvedor Browser;
- `enabled=true` explícito.

O token nunca pode existir no registry público, em argumento de linha de
comando, no frontend, em resposta HTTP, log, manifesto, documentação ou Git.

## Rota pública read-only

`GET /api/health/meta-destination` retorna somente o descritor redigido do
perfil EC ativo, com `Cache-Control: no-store`. A resposta inclui os IDs
públicos, perfil, origem, igualdade Browser/CAPI e booleano de token
configurado; nunca inclui o token. A rota reutiliza o proxy Nginx oficial já
existente para `/api/health/`, sem mudar a configuração do Nginx.

`public/n/index.html` só inicializa `fbq` depois de receber um destino
`available=true`, com token server-side presente e IDs iguais. Falha de rede,
timeout, HTTP não-2xx ou divergência bloqueia o Browser Pixel. O antigo
`noscript` com ID fixo foi removido porque não consegue participar de uma troca
atômica.

O endpoint entrega também um binding HMAC opaco, válido por seis horas e sem
material reversível do token. A página inclui esse binding nos eventos
server-side, inclusive os eventos intermediados por `vsl-entry` e pela rota de
lead. A telemetria inicial espera a resolução do destino antes de enviar. Assim,
uma sessão aberta antes de uma ativação continua enviando seu CAPI ao mesmo
perfil/ID inicial, mesmo que novas sessões já recebam o perfil novo. Binding
ausente conserva compatibilidade com chamadas server-side legadas; binding
presente porém malformado, expirado, adulterado, de outra rota ou de perfil
removido falha fechado. Perfis anteriores permanecem cadastrados justamente
para esse dreno e para rollback.

PageView e Lead conservam os `eventID` anteriores. Purchase continua somente
server-side e não ganhou nenhum caminho Browser novo.

## Helper operacional

Fonte versionada:

```text
scripts/manage-meta-destinations-v73.mjs
```

Comandos:

- `status`: read-only e redigido;
- `bootstrap`: cria a configuração inicial somente quando ela não existe;
- `plan-partner`: deriva obrigatoriamente o perfil ativo da rota e gera o plano
  para compartilhar esse Dataset; perfil histórico informado é recusado;
- `upsert-profile`: cria/atualiza apenas perfil inativo;
- `activate-profile`: exige o perfil ativo esperado e o Dataset novo esperado,
  além de validar token e igualdade Browser/CAPI antes da troca;
- `set-secret`: recebe token exclusivamente por stdin e não permite sobrescrever
  segredo usado por perfil ativo.

Todos os comandos mutantes são DRY RUN por padrão. `--apply` requer o gate
efêmero exato:

```text
META_DESTINATION_CHANGE_APPROVED=I_UNDERSTAND_META_BROWSER_SERVER_ATOMIC_CHANGE
```

O gate não deve ser persistido no `.env`. Em POSIX, apply operacional exige
root. Mutações compartilham um lock exclusivo fail-closed; lock pendente exige
auditoria antes de nova tentativa. Escritas usam arquivo temporário, `fsync`,
rename no mesmo filesystem, backup anterior não sobrescrito e modo `0600`.

## Proibições permanentes

- editar perfil ativo no lugar;
- compartilhar com parceiro um perfil histórico/inativo;
- ativar perfil sem token resolvido;
- ativar sobre estado diferente do perfil ativo esperado;
- executar duas mutações concorrentes ou ignorar lock pendente;
- Browser Pixel diferente do CAPI Dataset;
- substituir o Dataset Protocolo G por configuração;
- incluir token em argumento, saída ou arquivo público;
- criar Pixel paralelo só porque entrou uma conta parceira;
- disparar Test Event, PageView, Lead ou Purchase como parte do helper;
- reenviar Purchase histórico;
- usar qualquer conta, Pixel, domínio, VPS ou Git fora dos ativos EC oficiais.

## Rollback

Para compartilhamento de parceiro, rollback é remover a permissão da empresa
parceira no Meta Business Settings; o site não muda.

Para uma troca real, rollback é `activate-profile` para o perfil anterior, que
continua cadastrado e completo. Os backups ficam ao lado do registry em
`backups/`. Não editar o JSON manualmente em produção.

## Validação sem eventos

- testes unitários com tokens sintéticos;
- guard V61 de roteamento Meta;
- guard estático/runtime V73;
- inspeção de `GET /api/health/meta-destination`;
- leitura do status do helper;
- comparação do ID público com o ID server-side;
- nenhum POST de evento Meta durante deploy/validação.

## Preservado

- V72, V71, V70 e toda ancestralidade;
- site, dashboard, auth e health;
- modo `STRICT_READ_ONLY` e zero schedulers;
- Z-API, Baileys, WhatsApp, número oficial e anti-spam;
- Dropi em `REPORT_ONLY`;
- produtos, preços, VSLs, checkout e formulário;
- tracking, `event_id`, fbc/fbp, atribuição e Purchase já enviado;
- `production` Git sem movimento automático.
