# Congelado - Funil entrada livre, agencia e variacao

Data: 2026-05-26

Correcoes congeladas:

- Entrada livre no Vitalismen EC nao cai mais em bloqueio/humano quando nao ha etapa pendente. O cliente passa para o SDR principal e recebe pergunta de quantidade.
- A frase de confirmacao de quantidade deixou de usar a funcao antiga fixa `Le envio ... ¿Listo?` e agora usa a lista de variacoes aprovadas.
- Confirmacoes de agencia como `si sirve`, `sirve esa`, `confirma esa`, `esa me sirve` confirmam a agencia atual.
- Frases curtas de confirmacao/agencia nao podem mais ser salvas como nome do cliente.
- O numero piloto `5515998038637` foi liberado para teste novo apos a publicacao.

Arquivo alterado:

- `src/services/conversationEngine.js`

Processo PM2:

- `vitalismen-automation`
