# Freeze V21 — painel Tex Ultra, chamadas e destino Dropi

Data: 2026-08-17

Estado: candidato local validado parcialmente, nao publicado.

## Autorizacao e objetivo

Esta microcamada atende ao pedido explicito do operador para:

- disponibilizar o frasco oficial Tex Ultra no funil rapido manual;
- compactar as variacoes de nome, cidade, agencia e quantidade, deixando quantidade antes de cidade e nome por ultimo;
- retirar da ficha principal o bloco tecnico extenso do contexto V16;
- restaurar uma busca inteligente e controlada de dados recebidos do cliente;
- impedir rajadas de resposta quando o cliente liga;
- corrigir a divergencia entre cidade/agencia persistida e o payload final aberto no Dropi.

## Contratos congelados

### Painel

- `/media/sales/ec/tex_ultra.png` e a imagem oficial oferecida no atalho Tex Ultra.
- O envio da imagem exige atendimento manual EC e confirmacao humana explicita.
- Textos dos atalhos continuam apenas preparando o rascunho para revisao.
- A busca inteligente usa somente mensagens recebidas, preserva campos ja preenchidos e aplica dados somente apos clique do operador.
- O backend e os testes de `customer-current-context-v16` permanecem; apenas sua montagem visual extensa foi removida da ficha principal.

### Chamadas

- `WHATSAPP_CALL_AUTO_REPLY_ENABLED=false` e o estado padrao.
- Quando houver autorizacao operacional futura, Z-API e Baileys compartilham uma trava persistente por telefone.
- O mesmo `callId` nao pode gerar duas respostas.
- Eventos paralelos dos dois transportes para o mesmo telefone nao podem gerar uma rajada.
- A primeira tentativa elegivel usa somente o audio aprovado `CLIENTES_QUE_LIGAM`; ausencia do arquivo nao libera texto fallback automatico.
- Chamadas repetidas dentro de 15 minutos sao ignoradas.
- Depois do intervalo, no maximo um texto curto pode ser enviado na janela de 24 horas; as demais chamadas sao ignoradas.

### Dropi

- O payload final usa `normalizeEcuadorOrderFieldsForDropi`.
- Agencia com correspondencia segura usa nome, endereco, cidade e provincia do catalogo oficial Servientrega.
- Sem correspondencia segura, os dados sao limpos, mas nenhuma cidade/agencia e inventada.
- A selecao estrita de cidade da V18 permanece ativa.
- Envio Dropi continua exigindo autorizacao humana e confirmacao no painel.

## Preservado

- produto oficial Tex Ultra da rota `/n/`;
- ofertas de 1/2/3/6 frascos por USD 35.99/70.00/80.99/147.99;
- isolamento Nitrix e Vit Power;
- Dropi V18, Meta V19 e integridade de pedido V20;
- pixel, CAPI, Z-API, numero oficial, scheduler e memoria comercial;
- `current`, PM2, servicos, Cloudflare e producao.

## Validacao

- `git diff --check`;
- sintaxe Node dos arquivos alterados;
- `tests/panel-call-dropi-safety.test.mjs`;
- regressao de sintaxe do painel e testes puros que nao exigem dependencias externas.

Os gates que importam dependencias do projeto devem usar as versoes do `package-lock.json`. Se `node_modules` estiver ausente, nenhuma instalacao e permitida nesta etapa e o bloqueio deve ser relatado.

## Rollback

Antes de qualquer publicacao, descartar a microcamada e voltar ao commit `3b6adfb081f2391262e7b356d47473013e071cc7`.

Depois de eventual publicacao, preparar nova release imutavel desse commit e usar o helper transacional oficial com rollback para a release anterior. Nunca editar a release ativa nem o symlink manualmente.
