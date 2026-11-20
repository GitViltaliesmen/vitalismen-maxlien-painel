# VITALISMEN_EC — V254, fonte operacional

Runtime preparado `05f23b13cd89385a3cfdbdaf6c27d58f17384516`, parent real `c0664818c7468b9e7dfd55e320f77fcb273b77e5`. Este pacote preserva as fontes exatas, não comprova ativação. O manifesto publicado final e os recibos de ativação/ACK têm autoridade sobre o resultado operacional.

A confirmação comercial válida persiste intenção Purchase por compra; recompra usa nova identidade. Uma fila persistente própria controla envio e aceite `events_received > 0`. A Dropi mantém fila separada; erro comprovadamente anterior à criação pode ser retomado, criação incerta exige consulta exata. Não são removidos bloqueios humanos, opt-out, memória, histórico, QA ou limites de mensagens. Os destinos Meta de medições próprias são preservados. IP/navegador do atendente não representam o cliente; origem publicitária sem evidência continua não comprovada.

O painel real da ficha V253 e suas 592 agências permanecem intactos. A nova página de Leads mostra estado da entrega Purchase separado da atribuição publicitária. O legado Python só entrega a confirmação à fila nativa depois do corte; seu código completo continua privado. O patch versionado deve ser aplicado apenas ao hash anterior exato. A troca drena o legado antes de reservar a nova fila e só a libera depois da saúde do runtime. Não usar snapshot antigo do backend como página pública.

Recuperação administrativa só admite o plano privado dos oito recibos existentes, originalidade de data, preço, produto, identidade e destinos. Nenhum Dropi POST ou WhatsApp consta desse programa. A representação nativa faltante não cria pedido físico. Ledger aceito não é reenviado. Não repetir uma operação externa incerta nem descartar recibos para fazer rollback. O controlador recusa rollback ingênuo depois de efeito externo; usar sucessor que preserve os recibos.

Backups de código/configuração e dados EC dos casos são verificados separadamente. Não equivalem a backup global MongoDB. Credenciais, chave de recuperação, documentos dos clientes e plano privado não são publicados neste pacote.

Referência técnica: [parâmetros oficiais Meta CAPI v25](https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/v25.0/). A ocorrência comercial e a origem do evento devem ser verdadeiras; aceite de evento não comprova atribuição a anúncio.

## Complemento antes da ativação — nove casos

Durante a regressão chegou a confirmação nativa EC-MWO6UEZQ-QVQJ, já criada na Dropi como 8043790. Ela integra o plano privado de nove casos por confirmação comercial original; a geração da guia segue na Dropi, sem nova criação e sem condicionar o Purchase. O controlador usa BINDINGS com recover-existing-v254-r2.mjs, core-r2 e o teste de recuperação R2. A versão operacional anterior de oito casos permanece preservada e não foi ativada. O runtime 05f23b1 e sua regressão não mudaram. Os novos backups escopados incluem esse registro e restauram MongoDB/SQLite em ambientes isolados.
