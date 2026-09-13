# V153 — recuperação de áudio do painel e vínculo canônico do pós-venda

Data operacional: 2026-09-13.

Esta microcamada corrige três defeitos comprovados no Vitalismen Ecuador:

- o compositor do painel chamava `POST /api/whatsapp/funnel-media-upload-binary`, mas o backend não possuía essa rota e o guard retornava HTTP 423;
- a reconciliação V140 atualizava guia e estado logístico de Shipments existentes sem persistir a identidade canônica do cliente, impedindo P5/P6/P7 mesmo diante de entrega confirmada pela Servientrega.
- o guard Mongo V78 barrava a criação/atualização de pedido dentro do webhook Z-API, o contador transacional de vendedor nas rotas VSL e o registro de auditoria de ação do painel, embora essas rotas já tivessem `writeContext` operacional.

Garantias preservadas:

- upload somente após autenticação e autorização de administrador;
- arquivo armazenado no diretório compartilhado externo ao release;
- upload não chama Z-API, Baileys, Dropi, Meta nem qualquer provedor;
- tipo, tamanho, extensão e MIME são validados; nome físico é aleatório e escrita é exclusiva;
- identidade histórica só é completada quando telefone do Dropi, ContactState e Lead coincidem e quando Dropi, guia e consulta Servientrega são válidos;
- notificações históricas de guia, trânsito e retirada permanecem suprimidas;
- nenhuma varredura retroativa em rajada é liberada;
- as mutações recuperadas do núcleo são tuplas exatas de rota, coleção e método; deleção, rota genérica e escrita sem contexto continuam bloqueadas;
- número, provedor Z-API, VSL, Pixel, CAPI, funil, roteamento e pós-venda congelado permanecem inalterados fora desta microcamada.

Validação mínima obrigatória:

```sh
node scripts/guard-audio-postsale-recovery-v153.mjs
node --test tests/audio-postsale-recovery-v153.test.mjs tests/ec-phone-servientrega-reconciliation-v140.test.mjs
```
