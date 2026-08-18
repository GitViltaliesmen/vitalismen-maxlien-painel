# Freeze V24 — Comprar depois com data e lembrete unico

Data: 2026-08-18

Base: `bb2d92f65040fc678685358b626c2a4a8a5e9623`

Status: candidato aprovado pelo operador para publicacao apos auditoria; ainda nao publicado nem ativado em producao.

## Contrato aprovado

- `Comprar depois` exige a data desejada pelo cliente no painel integrado.
- A data e civil no formato `YYYY-MM-DD` e usa `America/Guayaquil` para calcular a janela.
- Existe somente uma janela de lembrete: das 09:00 de D-4 ate 18:59:59 de D-3.
- Existe no maximo um lembrete por contato, data e produto.
- O texto usa o primeiro nome validado, o periodo do dia e a identidade Ana Lopez.
- Tex Ultra, Nitrix Oxide e Vit Power mantem agendas independentes; a agenda copia a chave estruturada da ficha e nunca infere outro produto pelo texto do lembrete.
- Salvar novamente a mesma data e produto preserva `sentAt`; alterar data ou produto abre uma agenda nova.
- Sair de `Comprar depois` desativa a agenda sem apagar o historico.

## Travas obrigatorias

- flag `ADMIN_BUY_LATER_FOLLOWUP_ENABLED` com fallback `false`;
- lock atomico persistido em `ContactState.buyLaterReminder.lockUntil`;
- comprovante persistido em `ContactState.buyLaterReminder.sentAt`;
- consulta de `Message` antes do envio para recuperar uma tentativa concluida antes da gravacao do comprovante;
- chave antirrepeticao por contato, data e produto no transporte oficial;
- falha de envio nao pode preencher `sentAt`;
- uma falha de transporte encerra as tentativas automaticas daquela agenda e exige revisao humana, porque uma falha ambigua pode ter sido entregue;
- o lembrete nao usa audio, imagem, video ou documento;
- o lembrete nao cria nem confirma pedido, nao aciona Dropi e nao envia Meta/CAPI;
- testes nao podem usar destinatario real nem transporte externo.

## Dados e rollback

O subdocumento `buyLaterReminder` e aditivo no schema Mongo. Nao existe migracao destrutiva nem alteracao do banco oficial nesta preparacao. O rollback funcional e o commit base `bb2d92f65040fc678685358b626c2a4a8a5e9623`; documentos com o subdocumento novo sao ignorados pelo codigo anterior.

## Cliente de 22/08/2026

A data informada pelo operador nao identifica um registro sozinha. Nenhum cliente real foi procurado, alterado ou agendado durante a implementacao. O registro correto deve ser selecionado no painel e receber a data `2026-08-22` somente depois de a camada ser publicada e validada.
