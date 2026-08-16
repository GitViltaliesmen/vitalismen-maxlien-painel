# Freeze v15 — inteligência de dados do cliente EC

Data: 2026-08-15
País: Ecuador (`EC`)
Produtos: Nitrix, Vit Power e Tex Ultra

## Origem e autorização

Esta camada decorre da solicitação escrita do operador para tratar corretamente os leads vindos de `vilaliemen.shop/protocolo-g`, preservar os três produtos e tornar a ficha do cliente capaz de ler dados textuais e imagens sem retirar o controle humano.

## Contratos aprovados

- a CTA genérica `Hola, quiero el tratamiento` aceita os campos `Nombre`, `Teléfono`, `CIUDAD` e `PROVINCIA` anexados e usa exclusivamente `VITALISMEN_ACTIVE_VSL_PRODUCT`;
- a configuração ativa permanece `tex_ultra_ec`, sem transformar Tex Ultra em fallback global de fluxos antigos;
- nome explicitamente rotulado pelo cliente pode corrigir apenas um nome claramente concatenado; edição manual permanece prioritária;
- cidade e província são canonizadas somente pelo catálogo Servientrega Ecuador; resultado desconhecido ou ambíguo não é inventado;
- imagens recebidas oferecem leitura manual por botão `OCR`, com prévia e confirmação antes de preencher a ficha;
- o leitor não extrai telefone, documento, pagamento nem produto; a resposta da OpenAI usa saída estruturada e `store: false`;
- o formulário continua editável e o envio Dropi continua separado, manual e protegido pelos freezes anteriores.

## Preservação operacional

- nenhuma mensagem, áudio, mídia, evento Meta ou pedido Dropi foi enviado;
- nenhum cliente, pedido, histórico, banco ou estado de funil foi modificado;
- nenhuma dependência foi adicionada, removida ou atualizada;
- os manifestos v8–v14 permanecem inalterados;
- a VPS, o PM2, a extensão carregada no Chrome e a página externa `protocolo-g` não são modificados nesta camada;
- a publicação e a ativação em produção exigem autorização operacional separada.

## Rollback

Enquanto não houver publicação, o rollback consiste em retornar ao commit pai `e479ab61701619c35153d61063585cb4d92919a6`. Uma futura ativação em produção deve criar backup da release ativa e manter o symlink anterior para rollback imediato.
