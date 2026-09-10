# Candidata V147-R5 — pós-venda transacional

Base: R4 `b821dc09ace9021c14e1998624dbfad3d49312c6`, tree `47b6e8d0e6a82d1c8c040334296cf37a7d9bb2bd`.

A aprovação individual da remessa bloqueava o atendimento manual mesmo diante de evento logístico canônico. A exceção R5 limita-se a A07/A10/A19/P5/P6/P7 sob executor transacional V116 com as flags coordenadas existentes. Permanecem os bloqueios de revisão da remessa, supressão histórica e opt-out explícito persistido em `ContactState.engagementAutomation.blockedReason`. Atendimento manual comercial e autorização de Dropi permanecem intactos.

P5/P6 já são genéricos; seu código não passa a depender de produto. Somente P7 consulta o pedido EC pelo orderId ou pelo Dropi ID da própria remessa. O normalizador telefônico EC existente valida a identidade adicional. Evidência explícita do pedido, item Dropi e linhagem da própria remessa usam o catálogo oficial, inclusive seus aliases e IDs presentes nas URLs. Fontes divergentes resultam em produto desconhecido e revisão de P7, preservando P5/P6. Não há consulta por telefone para escolher produto, origem VSL como fallback, catálogo novo, atualização de histórico ou produto padrão.

Auditoria somente leitura de 22 casos: 21 resolvíveis pelo Order; 1 conflito (`EC-MRKS7J2F-OIQ8`: Order Vit Power versus item Dropi Nitric Oxide); 0 exclusivamente por item Dropi, 0 exclusivamente por linhagem, 0 sem evidência. O snapshot e a classificação permanecem protegidos em `/var/lib/vitalismen-deploy/evidence/v147-r5-transactional-postsale-20260910/`.

O evento 6886247 corresponde ao pedido `EC-ADMIN-3496`, cliente `6a9c0694f512f72e9aa802b2`, remessa `6a9f430434784e5138be3399`, guia `189613439`, produto Tex Ultra. A R4 foi ativada às 17:02:42Z; houve observação não terminal ENTERING_AGENCY às 17:05:18.685Z e persistência DELIVERED às 18:14:22.562Z de 2026-09-10. A prova é a sequência de consultas oficiais, sem presumir timezone da data textual do provider. Nenhuma etapa P5/P6/P7 foi aceita na auditoria. A supressão persistida é apenas `guide`; a candidata não remove supressões históricas nem altera watermarks.

Validação: testes focados, Mongo isolado com transporte SINK, roteador comercial real em manual, A07/A10/A19, P5/P6 genéricos, P7 dos três produtos, conflito, pacing após ACK, concorrência, dedupe e processo reiniciado. O replay usa a identidade canônica do evento e telefone sintético somente no banco SINK. O dispatcher R4 reavalia a entrega persistida após watermark sucessor sem alterar polling. A suíte SINK R4 preservada cobre fila READY obsoleta, histórico e concorrência do polling.

Antes de qualquer publicação: todos os gates, estágio oficial imutável, identidade congelada e aprovação do operador. Esta candidata não autoriza publicação. Após aprovação da mesma identidade: revalidar a guia ao vivo em leitura, confirmar DELIVERED, prova forward, opt-out ausente e etapas ainda pendentes; executar somente etapas faltantes em ordem P5, ACK/pacing, P6, ACK/pacing, P7 resolvido. Sem backfill histórico.

Os arquivos de polling V116, Servientrega, lifecycle, transporte, bot comercial, scheduler, catálogo e tooling instalado permanecem preservados por hash. A mudança de bootstrap apenas valida hashes sucessores exatos antes dos guards ancestrais. Recibo final fora do repositório evita autorreferência entre hash e commit.
