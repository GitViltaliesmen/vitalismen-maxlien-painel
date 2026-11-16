PROJECT=VITALISMEN_EC — VITALISMEN OFICIAL

# Chat do site: atendimento, voz e consulta de pedido

Versão V231-R2 publicada e auditada. Consulte o relatório técnico e o manifesto de congelamento desta entrega.

## Acesso do cliente

Na página `https://taviazen.shop/vitpower_2026g`, o cliente encontra o botão **Hablar con Ana**. Uma pequena mensagem convida para conversar após oito segundos, uma vez por visita, quando a página está visível. Fechar o convite mantém o botão disponível.

A conversa abre na lateral, sem escurecer ou bloquear a página. A VSL continua funcionando. O chat responde automaticamente sobre Vit Power usando o catálogo e as fontes oficiais existentes, acompanha o contexto e responde às perguntas na ordem apresentada. Quando não houver informação oficial suficiente, informa essa limitação e orienta a continuação pelo WhatsApp.

A oferta e o formulário de compra continuam obedecendo à liberação da CTA original. O chat não cria pedidos, não cobra e não envia mensagens WhatsApp em nome do visitante.

## Voz aprovada da Ana Lopez

Voz selecionada pelo operador: `qHkrJuifPpn95wK3rm2A`, com amostra aprovada em 16/11/2026. A credencial é exclusiva do chat web; a variável compartilhada das integrações existentes permanece preservada.

- **Escuchar:** reproduz a última resposta disponível daquela sessão.
- **Activar voz:** habilita a leitura das próximas respostas enquanto a conversa estiver aberta.
- **Desactivar voz** ou fechar a conversa interrompe o áudio.

O convite não toca áudio automaticamente. O visitante escolhe ouvir. O rodapé informa que o texto da resposta será enviado à ElevenLabs para a reprodução. O atendimento por texto continua disponível se a voz estiver indisponível. Repetir a reprodução de uma resposta utiliza o áudio em cache enquanto ele estiver válido.

## Acompanhamento pelo dashboard

No painel `https://ec.maxlien.shop/qr.html?v=20261112-v206`, abra **Chat do site** e selecione o visitante. A lista e o histórico usam a sessão administrativa existente. O popup permanece lateral e preserva o atendimento WhatsApp e os rascunhos.

As respostas do chat web são automáticas. O popup permite supervisionar a conversa e emitir o código de consulta; não inclui um campo para o operador enviar respostas humanas pelo site. A continuação com uma pessoa da equipe permanece no WhatsApp oficial.

## Consulta segura do pedido

O chat não libera pedidos apenas porque alguém informou um telefone. O processo é:

1. O cliente abre **Estado de mi pedido**. Se ainda não tiver acesso, usa **Solicitar código por WhatsApp**.
2. O atendimento verifica pelo canal oficial se a pessoa é titular do pedido solicitado.
3. No popup do dashboard, o administrador abre **Autorizar consulta de pedido**, informa o ID interno exato do pedido EC e o WhatsApp completo do titular e marca a confirmação de identidade.
4. **Gerar código privado** entrega um código para aquele pedido Vit Power. O administrador o fornece somente ao titular verificado. Não existe envio automático desse código.
5. O cliente cola o código no formulário privado **Estado de mi pedido** e toca em **Consultar**.

O código vale por 24 horas e fica vinculado ao primeiro navegador que o utilizar. Outro navegador, código vencido, pedido de outro titular, outro país ou outro produto não recebe o status. A recompra é um pedido diferente e exige autorização correspondente a esse novo pedido.

A resposta mostra **o último estado guardado no sistema**, a logística disponível e a data da última atualização do registro, no horário do Equador. Ela não representa uma nova consulta ao transportador. Nome, telefone e endereço não são exibidos na resposta.

O código pertence ao formulário privado e não deve ser escrito na conversa. A interface reconhece um código de 64 caracteres colado por engano no campo de mensagem e o encaminha para o formulário privado, sem enviar esse conteúdo à conversa com a IA. A consulta correta não inclui o código no histórico nem na chamada ao modelo.

## Operação e limites

Os limites existentes permanecem: 100 sessões por sete dias, 200 turnos diários, 20 turnos por sessão e duas respostas concorrentes. Atingir esses limites pode levar ao encaminhamento pelo WhatsApp; não é uma entrega de capacidade ilimitada. Em 16/11, 91 registros vazios antigos foram arquivados de forma recuperável para liberar a admissão, preservando todos os históricos. Essa manutenção foi pontual, sem limpeza automática adicionada. O histórico web é do navegador e não se sincroniza automaticamente com o WhatsApp. Código de acesso não é senha da ElevenLabs nem ID da voz. Nenhuma chave API deve ser colocada no HTML, na conversa do cliente ou no Git.

O diagnóstico e a recuperação de código/configuração não constituem backup global dos dados comerciais. O backup global MongoDB continua FAIL enquanto seu bloqueio de consistência não estiver resolvido.
