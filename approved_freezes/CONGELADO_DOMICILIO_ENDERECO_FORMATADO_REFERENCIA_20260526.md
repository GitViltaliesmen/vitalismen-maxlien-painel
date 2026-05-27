# Congelado - Domicilio com endereco formatado e referencia obrigatoria

Data: 2026-05-26

Regra aprovada:

- Para entrega a domicilio, endereco completo e ponto de referencia sao obrigatorios.
- O bot deve aceitar endereco baguncado e organizar em uma linha logistica limpa.

Formato aplicado:

`[Rua principal e intersecao], [Ponto de referencia com andar/cor da casa], [Cidade], [Provincia/Departamento], [Pais]`

Correcoes publicadas:

- Criado formatador `formatLogisticsAddressLine`.
- Criado `countryNameFromCode` para usar Ecuador/Colombia no fim da linha.
- Resumo final de domicilio usa `logisticsAddress`.
- Fechamento de domicilio grava/usa `logisticsAddress`.
- Entrada de endereco de domicilio tenta extrair cidade, provincia e referencia antes do resumo.
- Mensagens de coleta deixam claro que endereco completo e referencia sao obrigatorios.
- Numero piloto `5515998038637` liberado para novo teste.

Arquivo alterado:

- `src/services/conversationEngine.js`

Verificacao:

- `node --check src/services/conversationEngine.js`
- PM2 `vitalismen-automation` reiniciado.
- `/api/zapi/status` retornou conectado.
