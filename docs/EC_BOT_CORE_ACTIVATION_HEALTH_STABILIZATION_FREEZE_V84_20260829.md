# V84 — Estabilização limitada do health na ativação do núcleo EC

## Causa comprovada

A V83 passou por stage, publicação, ativação segura e `plan` do núcleo EC. A
ativação seletiva reiniciou o processo com o overlay correto, mas o helper fez
uma única consulta pública imediatamente após o restart. O 502 transitório
acionou contenção antes de o servidor completar o boot.

## Correção mínima

O helper V78 conserva o mesmo restart, overlay, permit, health e contenção, mas
repete somente a captura pós-restart por até 30 tentativas, com dois segundos
entre tentativas. A validação final continua sendo o contrato V78 existente e
qualquer ausência de health ao fim da janela continua falhando fechada.

## Preservado

- nenhuma regra comercial, preço, CTA, produto ou funil foi alterado;
- Z-API continua sendo o transporte oficial;
- schedulers mutantes continuam bloqueados;
- Dropi permanece `REPORT_ONLY`, com APPLY bloqueado;
- Meta Purchase permanece bloqueado;
- tráfego de clientes reais continua não autorizado;
- V83 e seus arquivos não substituídos permanecem byte intactos.

## Rollback

O rollback continua sendo o `contain` V78 e a contenção V66 já versionados. A
janela de estabilização é limitada a 60 segundos e não cria caminho de envio,
persistência ou mutação adicional.
