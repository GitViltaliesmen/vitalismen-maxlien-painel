# Regra de isolamento entre bots e seguranca compartilhada

Data: 2026-05-19.

## Decisao operacional

Atualizacao superior em 2026-05-21: para Vitalismen em producao, aplicar `docs/ISOLAMENTO_TOTAL_VITALISMEN_PRODUCAO.md`. Nesse modo, nao usar painel supervisor compartilhado nem camada global compartilhada com Aquecimento. Este documento fica como referencia historica para cenarios menos restritos, nao como regra maxima do Vitalismen.

Cada bot deve funcionar como uma operacao independente.

Bots previstos no painel supervisor:

- `Vitalismen - Trabalho Real`;
- `Aquecimento Seguro`.

O painel pode mostrar o status dos dois, mas nao pode misturar funil, banco, fila, historico operacional ou programacao propria de cada bot.

## Separacao obrigatoria

Cada bot deve ter vida propria:

- banco de dados proprio;
- fila de envio propria;
- memoria de funil propria;
- historico de atendimento proprio;
- regras de conversa e roteiro proprios;
- sessoes WhatsApp autorizadas para aquele bot;
- metricas e logs separados por bot.

E proibido usar o banco de um bot para decidir etapa, funil, produto, oferta, promessa, midia ou resposta do outro bot.

## Camada unica permitida: seguranca

Pode existir uma camada unica de seguranca, desde que ela nao misture funis nem copie memoria operacional entre bots.

Essa camada pode aplicar:

- regra de nao repeticao de mensagem;
- bloqueio de envio duplicado por telefone;
- cooldown por telefone;
- lista de bloqueio, opt-out e pedido para parar;
- trava de atendimento humano;
- bloqueio total de resposta automatica em grupos;
- historico minimo de seguranca para evitar spam;
- auditoria de envio com bot de origem, telefone, horario e tipo de mensagem.

Quando a seguranca for global, ela deve registrar sempre qual bot originou a acao. A regra global pode bloquear risco, mas nao deve escolher caminho de funil.

## O que nao pode ser compartilhado

Nao compartilhar entre bots:

- etapa de funil;
- script de conversa;
- carteira/lista de clientes;
- fila de mensagens;
- memoria de compra, interesse, objecao ou fechamento;
- midias oficiais de um funil sem decisao explicita;
- credenciais, auth dirs ou sessoes WhatsApp sem mapeamento claro;
- status de pedido, guia, retirada ou entrega;
- automacoes de follow-up.

Excecao permitida: uma lista global de seguranca, como `nao enviar`, `humano assumiu`, `telefone bloqueado` ou `cooldown global`.

## Regra para trocar funcao de um celular

Um numero nao deve mudar de bot no meio de conversa ativa.

Para trocar a funcao de um celular:

1. pausar o numero no bot atual;
2. esvaziar ou cancelar filas pendentes daquele numero;
3. confirmar que nao ha conversa em andamento que possa ser confundida;
4. registrar a nova funcao do numero;
5. ativar no novo bot com banco, fila e funil separados.

O painel pode ter um botao de troca de funcao, mas ele deve executar esse fluxo controlado. Nao deve apenas mudar o "cerebro" do numero ao vivo.

## Regra para o painel Conexoes

O modulo `Conexoes` pode virar um painel supervisor com cards separados:

- card do `Vitalismen - Trabalho Real`;
- card do `Aquecimento Seguro`;
- numeros conectados/desconectados de cada bot;
- botao de pausa/ativacao por bot e por numero;
- indicador claro de qual banco e qual funil aquele bot esta usando.

Esse painel supervisor deve ser apenas visual/operacional. Ele nao deve juntar chats, leads, filas ou historicos em uma lista unica.

## Guia e avisos a clientes

Avisos de guia, chegada, retirada, devolucao ou lembrete de cliente devem rodar dentro do bot dono daquele cliente.

Exemplo:

- cliente Vitalismen recebe aviso apenas pela automacao Vitalismen;
- cliente Aquecimento Seguro recebe aviso apenas pela automacao Aquecimento Seguro.

A camada de seguranca pode impedir repeticao ou excesso, mas nao pode enviar mensagem de um funil usando o contexto do outro.

## Regra para grupos

Nenhum bot deve responder grupo.

Bots devem responder somente conversa individual com cliente normal e telefone real resolvido.

Bloqueios obrigatorios:

- nao responder chats `@g.us`;
- nao responder `status@broadcast`;
- nao responder canal, comunidade ou lista de transmissao;
- nao responder ID tecnico sem telefone real resolvido;
- nao puxar dados de grupos para memoria, funil ou historico de cliente.

Se uma mensagem vier de grupo, o sistema deve ignorar para automacao de resposta. No maximo pode registrar log tecnico de seguranca, sem entrar em funil e sem enviar mensagem.
