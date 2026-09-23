# EC Panel Confirmed Python Serialization V159

Data: 2026-09-14

## Motivo

A V158 foi publicada, mas não ativada. No primeiro reparo controlado, o `Order`
foi criado no Mongo e a etapa SQLite falhou fechada porque os novos campos
booleanos do payload foram interpolados como literais JavaScript (`false`) dentro
do código Python. Python aceita `False`, não `false`.

## Correção

Os dois flags de controle são serializados como inteiros `0/1`, preservando a
semântica booleana no Python e o padrão já usado por `repurchase_cycle`.

- `require_existing_lead: Number(requireExistingLead === true)`;
- `force_human_confirmed_cycle: Number(forceHumanConfirmedCycle === true)`.

A V159 sucede a V158 sem reescrever a tag ou o release já publicados. O reparo é
idempotente e reutiliza o pedido confirmado criado pela tentativa anterior.

## Efeitos preservados

- nenhuma chamada WhatsApp, Z-API, Dropi ou Meta/CAPI;
- nenhuma mensagem enviada;
- nenhuma liberação de scheduler ou backlog;
- todas as proteções V157 e o contrato de persistência V158 permanecem ativos;
- V158 continuou fora de `current` durante a descoberta.

## Rollback

O release ativo continua V157 até que uma release sucessora passe por toda a
cadeia oficial. Dados afetados possuem snapshot root-only anterior à primeira
tentativa. Não reescrever a publicação V158.
