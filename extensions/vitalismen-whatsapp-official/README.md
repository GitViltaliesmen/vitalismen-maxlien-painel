# Vitalismen · WhatsApp Oficial v0.13.7

Esta versão isola os blocos iniciais de Nitrix, Vit Power e Tex Ultra e completa o início manual do Tex Ultra.

- 79 itens em Vit Power;
- 77 itens em Nitrix;
- 76 itens em Tex Ultra;
- 62 arquivos locais de áudio, imagem e vídeo;
- `PROMOCION_1_3_6` e `PRECIO_REAL_1_3_6` disponíveis nos três produtos;
- blocos personalizados antigos de Vit Power aparecem somente em Vit Power;
- textos, áudios, imagens e vídeos em modo enviar;
- blocos expansíveis com etapas;
- nenhum envio automático.

Extensão Chrome local que mantém o WhatsApp Web oficial como tela de conversa e
mostra o CRM Vitalismen no painel lateral.

## Gravação automática segura

- lê somente as mensagens recebidas do cliente;
- identifica nome, produto, quantidade, valor, endereço/agência, referência, cidade e província;
- grava automaticamente após breve espera, sem exigir clique;
- novas informações podem completar campos vazios mesmo depois de uma edição manual;
- campos alterados manualmente ficam protegidos contra substituição;
- o status `Confirmado` nunca é gravado automaticamente;
- confirmar pedido continua exigindo clique humano;
- autosave não assume atendimento, não envia mensagem e não envia ao Dropi.

## Padronização segura dos dados do cliente

- nomes são gravados com iniciais maiúsculas e conectores internos em minúsculas;
- cidade e província são padronizadas sem alterar telefone, produto, quantidade ou valor;
- a província é preenchida a partir do catálogo local somente quando a cidade tem correspondência única;
- cidades desconhecidas ou ambíguas não recebem província nem agências de outro local;
- o ponto de referência prioriza as agências compatíveis, mas nunca dispara mensagem automaticamente;
- o nome declarado pelo cliente tem prioridade sobre o nome de exibição do WhatsApp.

## Cadastro Tex Ultra

- o bloco `Inicio completo Tex Ultra` envia, mediante um clique humano por etapa: Inicio universal 01, Inicio universal 02, Prova 1, Frasco Tex Ultra e a tabela promocional desde USD 35,99;
- a tabela de preço original desde USD 39,99 permanece separada para escolha manual e não é enviada junto com a promoção;
- a mídia principal do Tex Ultra usa exclusivamente `legacy-media/sales/ec/tex_ultra_bottle.png`;
- o frasco Vit Power não aparece dentro da biblioteca Tex Ultra;
- Tex Ultra é o produto atual para novas fichas sem produto previamente salvo;
- quatro kits aprovados: 1 por USD 35,99; 2 por USD 70,00; 3 por USD 80,99; 6 por USD 147,99;
- um clique no kit preenche quantidade e valor;
- o valor Tex Ultra fica protegido contra alteração acidental;
- fichas em atendimento podem ser salvas incompletas;
- status `Confirmado` exige nome, telefone, endereço/agência, cidade, província, produto, quantidade e valor;
- o pedido operacional só é cadastrado depois de confirmação humana;
- nenhuma mensagem e nenhum pedido Dropi são enviados automaticamente.

## Ficha moderna e agências Servientrega

- uma única ficha reúne cliente, status e pedido, sem repetir os mesmos campos;
- cidade, província e ponto de referência pesquisam o catálogo oficial de agências dentro da própria extensão;
- o catálogo local completo permite continuar além das dez primeiras opções;
- as agências são exibidas e enviadas em lotes de quatro;
- a numeração é contínua: 1–4, 5–8, 9–12 e assim por diante;
- a frase inicial é enviada somente no primeiro lote da sequência;
- escolher uma agência preenche endereço, cidade e província sem apagar a referência do cliente;
- cada mensagem é enviada diretamente à conversa selecionada no WhatsApp Web.

## Funil por produto

- bibliotecas isoladas para Vit Power, Nitrix e Tex Ultra;
- recomendação visual conforme a etapa atual;
- filtros e pesquisa;
- dados da ficha aplicados ao texto;
- botão `Enviar` em todos os textos e mídias;
- integração interna WA-JS para envio direto na conversa aberta do WhatsApp Web;
- botão `Funil` colocado na barra inferior da conversa oficial;
- janela independente sobre a área do WhatsApp, arrastável, redimensionável, minimizável e fechável;
- posição e tamanho preservados no navegador;
- recuperação automática quando uma altura vazia ou inválida estiver gravada;
- painel inicial ampliado para trabalho contínuo;
- biblioteca oficial de áudios EC carregada do mesmo backend do painel antigo;
- reprodução dentro do funil e envio direto do áudio como mensagem de voz;
- imagens, vídeos, documentos e textos enviados diretamente à conversa selecionada;
- etiquetas Atendendo, Confirmado, Enviado, Em rota, Entregue, Retorno e Cancelado visíveis na lista de conversas;
- motor WA-JS 4.4.3-alpha empacotado e carregado somente depois de o WhatsApp terminar de abrir;
- telefone capturado imediatamente ao pressionar uma conversa no WhatsApp;
- funil movido para a camada principal e aberto automaticamente ao selecionar o cliente;
- canal local estável com verificação e recarga automática de arquivos atualizados.
- sessão persistente com token protegido; a senha nunca é armazenada;
- largura menor para movimento horizontal e alça de redimensionamento.
- ficha do cliente permanece livre e nunca é coberta automaticamente;
- troca de conversa atualiza cliente, produto, etapa e respostas do funil;
- conexão automática usando a sessão já autenticada do painel `ec.maxlien.shop`;
- validação do token pelo endpoint oficial `/api/auth/me`;
- login manual mantido apenas como recuperação.

## Segurança

- o envio somente acontece após clique humano no botão `Enviar`;
- a conversa aberta é validada antes de cada envio;
- a extensão envia pelo motor interno da sessão já autenticada no WhatsApp Web;
- login fica apenas na sessão do Chrome;
- histórico continua no backend;
- assumir atendimento e salvar ficha exigem clique humano.

## Carregar no Chrome

1. Abra `chrome://extensions`.
2. Ative **Modo do desenvolvedor**.
3. Remova ou desative a cópia anterior da extensão Vitalismen.
4. Clique em **Carregar sem compactação**.
5. Selecione a pasta que contém este arquivo e o `manifest.json`.
6. Abra o WhatsApp Web e clique no ícone da extensão.

Após carregar a versão 0.13.7, recarregue a extensão e a aba do WhatsApp Web uma única vez.
O motor interno de transporte permanece congelado na revisão 0.11.5.
