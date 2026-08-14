# Freeze EC - Refinamento de Agencias por Setor - 2026-06-22

## Problema

Quando uma cidade/provincia tinha muitas agencias Servientrega, o bot podia listar opcoes sem pedir uma referencia melhor do cliente. Isso criava listas longas e risco de escolha ruim.

## Correcao

- Mantida prioridade logistica antes de data/agendamento.
- Para cidade/provincia com mais de 4 agencias, o bot pergunta se o cliente sabe nome, endereco ou setor da agencia.
- Se o cliente informa setor, o bot filtra por setor e lista em blocos de 4.
- Se o cliente diz que nao sabe, o bot lista as opcoes gerais da cidade/provincia.
- A numeracao de mais agencias continua em sequencia: 1-4, 5-8, etc.
- Cada opcao agora mostra agencia, endereco, cidade/provincia e setor quando disponivel.
- Cidades com ate 4 agencias seguem listando direto.
- Cidades com 1 agencia seguem em confirmacao direta.

## Arquivos Alterados

- `src/services/conversationEngine.js`

## Backup

- `backups/ec-agency-sector-layer-20260622/conversationEngine.js`
- `backups/ec-agency-sector-layer-20260622/servientregaEcuadorAgencyService.js`

## Provas

- `node --check src/services/conversationEngine.js`
- `node --check src/services/servientregaEcuadorAgencyService.js`
- `node --check src/routes/whatsapp.js`
- `node --check src/services/vitPowerAudioComplementService.js`
- Simulacao `Quito/Pichincha` sem setor: pede refinamento.
- Simulacao `Quito/Pichincha sector norte`: lista 1-4 somente com setor Norte.
- Simulacao proxima pagina: lista 5-8 mantendo setor Norte.
- Simulacao `no se`: lista opcoes gerais sem pedir setor de novo.
- Simulacao cidade com 1 agencia: confirma direto.
- Simulacao cidade com 2-4 agencias: lista direto.
- Regressao `Ricaurte`: nao vira cidade/provincia por chute.
- Regressao `Ricaurte Babahoyo`, `Capitan Ricaurte Chunchi`, `Ricaurte Jipijapa`: seguem resolvendo agencias corretas.

## Regra Final

Se houver muitas agencias na cidade/provincia, o bot deve perguntar primeiro se o cliente sabe nome, endereco ou setor. Se o cliente nao souber, lista por blocos de 4. Se pedir mais, continua a numeracao sem reiniciar.
