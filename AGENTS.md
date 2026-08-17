# Regras Fixas do Projeto

## Regra maxima EC Maxlien — Tex Ultra / Nitrix / Vit Power

Regra maxima e permanente: este projeto, quando tratar de `ec.maxlien.shop/n/`, e somente Equador na VPS Hostinger oficial, Git Equador e dominio publico oficial:

```sh
https://ec.maxlien.shop/n/
ssh root@72.60.137.77
/opt/vitalismen-automacao/current
```

Decisao operacional mais recente, autorizada pelo operador em 2026-07-26:

- produto oficial do trafego atual `/n/`: Tex Ultra Ecuador;
- tabela promocional Tex Ultra: 1 frasco USD 35.99, 2 frascos USD 70.00, 3 frascos USD 80.99 e 6 frascos USD 147.99;
- Nitrix Oxide Ecuador e Vit Power Ecuador continuam disponiveis para selecao/alteracao manual no painel e envio controlado ao Dropi;
- cada VSL conserva seu proprio produto de origem: `/n/` abre Tex Ultra, `/m/` abre Vit Power e uma entrada Nitrix explicitamente identificada abre Nitrix;
- o painel e multiproduto, mas a troca manual vale somente para a ficha/pedido daquele cliente e nunca altera a atribuicao das outras VSLs;
- a origem da VSL deve permanecer registrada separadamente mesmo quando o operador troca o produto do pedido a pedido do cliente;
- toda oferta deve usar `frasco`/`frascos`, nunca `mes`/`meses`;
- nenhum funil, audio, imagem ou prova de outro produto pode ser aplicado automaticamente ao Tex Ultra.

Correcao obrigatoria de nomenclatura: nao e Superfull. Superfull nao deve ser criado, roteado, citado, reaproveitado ou tratado como produto deste fluxo.

E proibido misturar, importar, copiar, comparar ou publicar qualquer coisa de Colombia, Contabo, Maxtourus, outro dominio, outro numero, outro banco, outro pixel, outro funil, outro VPS ou outro Git sem pedido explicito do operador citando exatamente essa origem.

Qualquer mudanca neste fluxo deve ser micro camada pontual. Nao esta autorizado mexer no motor principal do bot, preco, checkout, Dropi, Meta/CAPI, pixel, Z-API, numero de WhatsApp, funil comercial ou memoria de pedidos sem aprovacao explicita.

Estado congelado e trava de escopo:

```sh
FREEZE_EC_NITRIX_VIT_POWER_MICRO_LAYER_20260708.md
```

Guard obrigatorio antes de publicar alteracao de produto EC:

```sh
node scripts/audit-ec-product-micro-layer.mjs
```

## Regra maxima anti-spam WhatsApp EC

Nunca deixar scheduler reenviar automaticamente a mesma midia, guia, print, fatura, audio ou mensagem para o mesmo cliente/pedido.

Risco maximo: repeticao automatica pode banir o WhatsApp oficial `553183002800`.

Incidente congelado:

```sh
FREEZE_EC_GUIDE_PRINT_SPAM_GUARD_20260708.md
```

Antes de finalizar qualquer deploy no VPS, conferir obrigatoriamente que o PM2 esta executando o release atual, nao apenas que o symlink `current` mudou:

```sh
pm2 jlist
readlink -f /opt/vitalismen-automacao/current
```

O processo `vitalismen-automation` precisa ter `pm_cwd` e `pm_exec_path` apontando para o release ativo. Se PM2 continuar em release antigo, recriar apenas esse processo apontando para `/opt/vitalismen-automacao/current`.

Qualquer scheduler que envia ao cliente precisa ter:

- campo persistido no schema para "ja enviado";
- lock persistido no schema;
- busca por historico antes de reenviar;
- guard automatizado cobrindo os pontos acima.

## Modos operacionais oficiais e transporte WhatsApp EC

O contrato versionado de `scripts/senior-guard.mjs` e a fonte de verdade para a combinacao de flags. Existem somente dois estados validos; combinacoes parciais sao proibidas.

No modo observacao/nao operacional, identificado pela ausencia de `VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED=true`, as flags de funil, resposta automatica, roteamento inbound, scheduler e automacoes pos-venda protegidas pelo guard permanecem desligadas. Nesse modo, `WHATSAPP_FUNNEL_ENABLED=false` e uma trava anti-legado.

No modo operacional aprovado, identificado por `VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED=true`, todas as flags acopladas devem ter exatamente os valores exigidos pelo senior guard. Nesse modo completo, `WHATSAPP_FUNNEL_ENABLED=true` nao e violacao e nao autoriza retorno de `src/services/funnelService.js` ou de qualquer fluxo removido.

Nunca alterar apenas `WHATSAPP_FUNNEL_ENABLED`. A troca entre modos e uma mudanca operacional coordenada, exige decisao explicita e deve manter o conjunto inteiro validado pelo senior guard.

Para a operacao EC atual, Z-API e o transporte oficial de entrada/saida publica. Baileys pode permanecer habilitado ou em `scanning` como camada coexistente, mas a falta de sessao Baileys pronta nao torna a operacao indisponivel quando a Z-API oficial estiver configurada e conectada. O health deve consultar a Z-API por mecanismo somente leitura, sem enviar mensagens, criar sessao ou modificar estado.

## Congelamento total atual

O estado aprovado em 2026-05-17 esta congelado em:

```sh
docs/CONGELAMENTO_TOTAL_VITALISMEN_2026-05-17.md
approved_freezes/CONGELADO_TOTAL_VITALISMEN_20260517_021215.txt
```

Antes de mexer em painel WhatsApp, Dropi Ecuador, funil Vit Power, midia, audio, imagem, video, foto da Valeria, memoria de cliente, numeros conectados, filtro EC, pedidos confirmados ou formulario de cliente, ler esse congelamento.

Regra dura: nao alterar, remover, reordenar, simplificar ou refazer comportamento congelado sem pedido explicito do operador citando o ponto que deve mudar.

## Isolamento de outros projetos de automacao

Este projeto e somente a automacao oficial Vitalismen / Vit Power Ecuador.

Os caminhos locais oficiais e autorizados são:

```sh
/Users/greson/Documents/Vitalismen Automacao
C:\Users\Wolfe\Documents\SITES\MAXLIENSHOP_JULHO_2026\Vitalismen Automacao
```

O caminho oficial no VPS e:

```sh
/opt/vitalismen-automacao/current
```

Antes de trabalhar, conferir o marcador `.vitalismen-official-root` e rodar `npm run official:path` quando houver qualquer duvida de contexto.

Nao abrir, alterar, comparar, empacotar, testar, iniciar, parar, deployar ou usar como referencia qualquer outro projeto de automacao sem pedido explicito do usuario citando esse projeto.

Projetos fora de escopo incluem, mas nao se limitam a:

- `/Users/greson/Documents/New project 4/[aquecimento total maio de 2026]`
- qualquer automacao de aquecimento separada da Vitalismen;
- copias antigas, zips, pastas temporarias ou projetos paralelos.

Se a conversa disser apenas "retome", "continue", "o bot", "a automacao" ou algo semelhante, assumir sempre a pasta oficial do sistema operacional atual:

```sh
/Users/greson/Documents/Vitalismen Automacao
C:\Users\Wolfe\Documents\SITES\MAXLIENSHOP_JULHO_2026\Vitalismen Automacao
```

Antes de usar outra pasta, confirmar com o usuario. Se houver confusao de contexto, parar e reancorar em `.vitalismen-official-root`, `docs/CAMINHO_OFICIAL_UNICO.md`, `PROJETO_OFICIAL_VITALISMEN.md`, `docs/RETOMADA_2026-05-10.md` e nesta regra.

## Arquivos oficiais primeiro

Antes de alterar qualquer VSL, checkout, painel, automacao, funil, Dropi, WhatsApp ou integracao:

1. Localizar qual e o arquivo oficial em producao ou a fonte de verdade registrada.
2. Ler o arquivo oficial atual antes de editar.
3. Ler `docs/ARQUITETURA_AUTOMACAO_OFICIAL.md` antes de mexer em funil, WhatsApp, prompt, audio ou scheduler.
4. Se o arquivo oficial estiver no VPS, baixar ou inspecionar a versao do VPS antes de aplicar patch local.
5. Fazer backup do arquivo oficial antes de substituir em producao.
6. Aplicar a menor alteracao possivel.
7. Validar na URL/servico oficial depois do deploy.
8. Registrar o caminho oficial, backup e validacao em `docs/ARQUIVOS_OFICIAIS.md` ou no documento operacional correspondente.

Nao editar com base em copia temporaria, zip, pasta antiga, `.codex-tmp`, print, memoria da conversa ou suposicao quando houver arquivo oficial acessivel.

## Ordem de prioridade

1. VPS em producao.
2. Arquivo oficial registrado em `docs/ARQUIVOS_OFICIAIS.md`.
3. Pasta local oficial: `/Users/greson/Documents/Vitalismen Automacao`.
4. Documentacao em `docs/`.
5. Copias temporarias ou antigas somente como referencia.

## Regra fixa do painel WhatsApp

No painel integrado `public/qr.html`, a coluna esquerda de conversas (`#chatList`, `.chat-item`, `renderChats`) nunca deve exibir texto de mensagens. Ela serve somente para listar contatos/conversas com avatar, nome/telefone, horario e selos operacionais como `Fechou`, `Humano` ou status de pedido.

Conteudo de mensagem (`message.body`, `chat.lastMessage.body`, transcricoes, midia ou texto completo) deve aparecer exclusivamente no painel central da conversa (`#conversation`, `renderMessages`) depois que o contato for selecionado.

E proibido recolocar `chat.lastMessage.body` ou qualquer preview textual de mensagem dentro de `.chat-item`, `.chat-preview`, `.chat-title` ou `.chat-foot`. Busca interna pode usar campos de mensagem se necessario, mas nada disso deve ser renderizado na coluna esquerda.

O painel Vitalismen nao deve misturar contatos de outros projetos, aquecimento, status do WhatsApp, grupos ou IDs tecnicos LID sem telefone real. A lista de conversas e metricas deve ser filtrada pela sessao oficial conectada da Vitalismen e mostrar apenas chats validos com telefone resolvido.

Antes de publicar qualquer mudanca no painel, validar que:

- `document.querySelectorAll('.chat-preview .meta').length === 0`;
- ao selecionar um contato, as bolhas aparecem em `#conversation`;
- a lista esquerda continua sem mensagem junto ao numero.
- `status@broadcast`, chats `@g.us` e IDs `@lid` sem telefone real nao aparecem como clientes.

## Funil Vit Power congelado

O funil inicial Vit Power do Equador esta congelado como processo oficial em `docs/FUNIL_ATENDIMENTO_FECHAMENTO.md`.

Nao refazer nem trocar a ordem aprovada sem pedido explicito. A ordem oficial e:

3. `social_01`
4. `social_02`
5. `vit_power_bottle`
6. texto de valores perguntando quantos frascos deseja

O sistema deve gravar memoria por contato para nao repetir etapas ja enviadas e deve respeitar pausas humanas configuradas por `INITIAL_FUNNEL_*`.

Formulario da VSL/CTA nunca deve ser respondido por IA livre quando trouxer dados de pedido. A regra oficial e deterministica: salvar os dados, perguntar somente campo faltante, ou enviar confirmacao final sem telefone quando estiver completo.

Regra operacional atual: o funil deve ler intencao forte antes de aplicar a etapa rigida. Quantidade clara, confirmacao, dados de pedido, entrega em agencia/domicilio e correcao de dados devem ser capturados, salvos e usados para continuar pelo proximo campo faltante. Se o cliente quebrar a ordem, nao reiniciar o funil.

Depois da apresentacao/preco, resposta de quantidade (`1`, `uno`, `1 frasco`, `3`, `tres`, `3 frascos`, `6`, `seis`, `6 frascos`) tem prioridade sobre complemento de audio. O bot deve enviar o audio especifico da quantidade, nao o audio geral `TRATAMENTO_Y_PRECIOS_PROMOCAO`.

Automacoes legadas que conflitam com o funil Vit Power foram removidas do caminho automatico:

- `src/services/funnelService.js` nao deve voltar.
- Recuperacao de rascunho nao deve voltar ao scheduler.
- Scheduler automatico de envio/retirada nao deve voltar sem decisao explicita.

Antes de testar ou mexer em automacao, rodar:

```sh
npm run senior:check
```

Quando a mudanca envolver o VPS, tambem verificar em producao:

```sh
cd /root/wa_wpp
npm run senior:check
```

O VPS `/root/wa_wpp` possui fluxos antigos bloqueados por flag. Nao religar `SERVER_FUNNEL_ENABLED` nem `AI_WORKER_ENABLED` sem pedido explicito e sem registrar a decisao em `docs/ARQUITETURA_AUTOMACAO_OFICIAL.md`.

Nao religar nem recriar caminhos antigos sem atualizar `docs/ARQUITETURA_AUTOMACAO_OFICIAL.md`.
