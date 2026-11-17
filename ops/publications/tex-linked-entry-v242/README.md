PROJECT=VITALISMEN_EC — VITALISMEN OFICIAL

Tex Ultra V242: entrada única entre WhatsApp e chat da VSL.
O cliente informa primeiro nome e WhatsApp EC. A confirmação exige mensagem enviada pelo próprio cliente, com nonce temporário, recebida no webhook oficial e persistida na sessão Z-API correta. A confirmação não dispara mensagem externa.
O primeiro canal confirmado recebe a apresentação existente em cinco etapas: saudação, áudio de introdução, prova aprovada, frasco Tex Ultra e tabela promocional. Um registro persistido por telefone impede repetir a apresentação em outro navegador ou canal. Tentativa ambígua não gera retry automático. Humano e opt-out continuam prioritários.
O popup existente mostra identidade confirmada e etapas, usando a renderização autenticada de mídia. A lista principal e o compositor manual permanecem iguais.
Vídeo, CTA, Turbo, telefone nativo, página informativa de desktop, preços, pedidos, Dropi, Z-API e Meta/CAPI não são alterados.
Validação: testes puros, HTTP e armazenamento em namespaces isolados, regressões, controle de ativação e recuperação criptografada. Evidências finais de publicação são registradas separadamente; este commit de assets não afirma ativação.
Rollback: desativar somente a capacidade V242 e restaurar os dois assets/popup. Conservar código compatível e todo o journal de identidade e não repetição. O controller bloqueia retorno ao código antigo após entrada web consumida. Não restaurar MongoDB nem resetar contatos.
