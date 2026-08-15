# Freeze v13 — isolamento dos funis iniciais EC

Data: 2026-08-15
País: Ecuador (`EC`)
Produtos: Nitrix, Vit Power e Tex Ultra

## Objetivo

Esta camada corrige de forma localizada a biblioteca manual de funis. Cada produto passa a ter seu próprio bloco inicial. O Tex Ultra deixa de herdar a alternativa Vit Power e recebe o bloco solicitado:

1. Inicio universal 01;
2. Inicio universal 02;
3. Prova 1;
4. Frasco Tex Ultra;
5. tabela promocional de 1, 2, 3 e 6 frascos, iniciando em USD 35,99.

A tabela iniciada em USD 39,99 permanece disponível como texto separado de preço original/Promoção 2. Ela não integra a sequência automática do bloco inicial, evitando o envio consecutivo de duas ofertas conflitantes.

## Isolamento e preservação

- os três blocos personalizados preexistentes reconhecidos como Vit Power continuam armazenados e editáveis;
- esses blocos aparecem somente quando Vit Power é o produto ativo;
- blocos novos recebem o produto selecionado na ficha no momento da criação;
- blocos genéricos que não permitem inferência segura continuam com escopo `all`, sem exclusão ou reclassificação destrutiva;
- Nitrix mantém seus dois áudios universais próprios e o frasco Nitrix;
- Vit Power mantém seus áudios genéricos aprovados, a Prova 1 e o frasco Vit Power;
- Tex Ultra usa exclusivamente o frasco Tex Ultra no seu bloco inicial e na mídia principal;
- todos os textos Tex Ultra usam `frasco/frascos`, sem tratar quantidade como meses;
- nenhuma dependência, banco, cliente, integração, pedido ou histórico foi alterado.

## Segurança operacional

- o envio continua exclusivamente manual, iniciado por clique humano em `Enviar`;
- a implementação e os testes não enviam mensagem, áudio, mídia ou evento a cliente real;
- a Promoção 2 não é disparada junto com a Promoção 1;
- não há chamada Dropi, Meta, Z-API, WhatsApp ou backfill nos testes desta camada;
- a extensão passa à versão `0.13.7`;
- a pasta carregada no Chrome e a VPS não são alteradas por esta camada sem autorização operacional separada;
- `publicationStatus: not_published` deve permanecer imutável neste freeze.

## Relação com os freezes anteriores

O freeze v13 é descendente do freeze v12. Nenhum manifesto ou documento v8–v12 é modificado. `public/qr.html`, protegido originalmente no v8, recebe uma nova versão autorizada e passa a ser protegido pelo v13; o hash e o manifesto históricos do v8 permanecem registrados e intactos.

Rollback local: retornar ao commit pai desta camada. Uma eventual ativação futura deve possuir backup próprio e procedimento de rollback específico para a extensão carregada e para a release da VPS.
