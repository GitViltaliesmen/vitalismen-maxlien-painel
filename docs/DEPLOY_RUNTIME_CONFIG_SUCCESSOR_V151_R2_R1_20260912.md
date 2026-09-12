# V70 runtime-config-successor V151-R2 R1

Escopo exclusivo: microcamada de tooling de deploy para atestar a transição já realizada pela V151-R2. Nenhum arquivo da aplicação, release, candidata V152-D ou configuração `.env` é alterado por esta mudança.

O contrato R1 é fail-closed e reconhece somente a combinação exata abaixo:

- release predecessora `20260911T015641Z_production-20260911-59d12bf`;
- backup `/opt/vitalismen-automacao/backups/v151-r2-whatsapp-20260911T220814Z/.env.pre-v151-r2`;
- SHA-256 predecessor `4e17c7f06df31e29c6c746fbaef29e70174076a2fb69c44a999d97400a3b0b4d`;
- SHA-256 sucessor `edae8ca26679b54e517ad6a050aefd0b27a1e1fe20edf922b3fb72afcb66664f`;
- única chave adicionada `WHATSAPP_BLOCKED_SESSION_IDS`;
- nenhuma chave removida;
- evidência V151-R2 `/var/lib/vitalismen-deploy/evidence/v151-r2-whatsapp-20260911/hostinger-channel-freeze.json` com SHA-256 `c78302143a57070aae1e4d8d13a0dd6cd519a0f1bae782936c9fb4464b5433dd`.

Não existe wildcard, prefixo, expressão regular ou autorização genérica. O validador compara somente nomes/presença das chaves entre os dois arquivos protegidos e exige correspondência exata de todos os hashes. Mudanças de valores permanecem opacas: não são serializadas, impressas ou incluídas no recibo.

O recibo R1 tem somente os dez campos autorizados pelo supervisor, serialização JSON canônica e selo SHA-256 separado. Recibo e selo precisam ser arquivos regulares, sem symlink, `root:root`, modo `0600`, dentro do diretório `root:root` modo `0700`. O gerador é de uso único e falha se o recibo já existir; em falha durante a criação, remove somente os arquivos que acabou de criar.

A evidência é validada pelo hash e por metadados mínimos V151-R2: operação, números novo e antigo, preservação bloqueada/inativa do número antigo, transporte Z-API online, configuração ativa, arquivo alterado e caminho do backup. Campos extras no recibo falham, o que impede incorporar valores de segredo.

Compatibilidade: a rota versionada anterior para rotação de chaves existentes continua exigindo seu formato V1, recibo/selo `0400`, cadeia de hashes, provas e tooling. A exceção de compatibilidade aceita somente o SHA-256 congelado do próprio validador V1 anterior no único caminho oficial; não autoriza outro arquivo ou hash.

## Instalação e rollback

Antes da instalação, arquivar o validador oficial atual com hash e metadata. Instalar apenas `ops/lib/runtime-config-successor-v1.cjs` como `root:root` `0400` e o gerador como `root:root` `0500`; o helper `/usr/local/sbin/vitalismen-stage` permanece byte a byte intacto. Gerar e validar o recibo antes de reexecutar `v70-publish`.

Rollback do tooling: restaurar o validador arquivado e remover somente o gerador instalado. Isso volta a bloquear a adição de chave; não restaurar `.env`, não mover `current`, não reiniciar PM2 e não alterar a candidata.

## Testes mínimos

A suíte Linux cobre rotação existente, adição única válida, allowlist exata, segunda adição, remoção, hash sucessor incorreto, backup/evidência ausentes, evidência adulterada, wildcard, campo secreto adicional e owner/mode incorretos. Sintaxe do módulo e do gerador também é validada antes da instalação.
