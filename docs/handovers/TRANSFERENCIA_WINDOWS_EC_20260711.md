# Transferência segura para Windows — operação EC

Registro: 2026-07-12 UTC / 2026-07-11 America/Sao_Paulo.

Este documento permite retomar o projeto em outro computador sem expor senhas, chaves privadas, tokens ou códigos 2FA no Git ou no chat.

## Endereços operacionais não secretos

| Finalidade | Endereço ou caminho |
| --- | --- |
| Repositório GitHub | `https://github.com/GitViltaliesmen/vitalismen-maxlien-painel.git` |
| Branch operacional | `codex-vitpower-unified-front` |
| Site Nitrix EC | `https://ec.maxlien.shop/n/` |
| Painel EC | `https://ec.maxlien.shop/qr.html` |
| Host VPS | `maxlien.shop` (SSH: `root@maxlien.shop`) |
| App na VPS | `/opt/vitalismen-automacao` |
| Repositório bare na VPS | `/opt/git/vitalismen-automacao.git` |

No momento deste registro, o Git compartilhado está no commit `f36a248bde736cb7c48e7e252f5170b87d4e13f3`. O runtime executável permanece intencionalmente no código `d861889c3933bc4808c339e628ef7ec4e4a722f6`, porque os commits posteriores são documentação de handoff/observação, sem mudança de aplicação.

## O que copiar do Mac

1. Clone o repositório no Windows a partir do GitHub. Não copie `node_modules`; execute `npm ci` no novo computador.
2. Copie **todo** o diretório `/Users/greson/Automacao Vitalismen/` para um contêiner criptografado. Ele contém cerca de 613 MB de backups, handoffs, snapshots ativos/patched e material fora do Git que não deve ser perdido.
3. Dê prioridade a `backups/`, `docs/`, `state/`, `public/`, `approved_freezes/` e `cleanup-quarantine/` dentro desse diretório.
4. Inclua no mesmo contêiner criptografado, e nunca no Git ou em nuvem desprotegida:
   - `/Users/greson/Documents/Vitalismen Automacao/.env`;
   - `/Users/greson/Automacao Vitalismen/.env.vps.release-bot`;
   - `backups/EC_FULL_RELEASE_20260711_203456_private-handoff.tar.gz`.

O arquivo `EC_FULL_RELEASE_20260711_203456_private-handoff.tar.gz` contém um `.env`. Ele é um `tar.gz` válido, mas **não é criptografado**; a permissão local `600` não protege após ser copiado. Por isso ele só pode ser transportado dentro de armazenamento criptografado.

Para gerar esse contêiner sem criar um `tar.gz` aberto no disco, execute no Terminal do Mac:

```bash
cd "/Users/greson/Documents/Vitalismen Automacao"
bash scripts/create-windows-transfer-encrypted.sh "/Volumes/NOME_DO_DISCO"
```

Troque `NOME_DO_DISCO` pelo seu HD/pendrive montado, ou omita o argumento para gerar no Desktop. O script pede a senha diretamente no Terminal, inclui os dois diretórios completos e produz somente `EC_TRANSFER_*.tar.gz.enc` e o respectivo `.sha256`. Ele não copia a chave SSH privada antiga; crie uma nova chave no Windows antes de revogar a do Mac.

## Backup exato do bot em funcionamento

Em `2026-07-12T02:23:25Z` foi criado na VPS, sem reinício do PM2, o snapshot do release que está atendendo clientes:

- arquivo: `/root/codex_deploy_backups/ec-current-bot-runtime-20260712T022325Z.tar.gz`;
- release incluído: `20260711233201_git_d861889` / código `d861889c3933bc4808c339e628ef7ec4e4a722f6`;
- inclui: árvore da aplicação e `.env` do release; exclui `.git` e `runtime`;
- SHA-256: `e00b35dd6cd58bf9bcc5c9d67e1b14896261255fd746f48255fe5003adbbe500`;
- manifesto root-only: arquivo homônimo com sufixo `.manifest.txt`.

Esse arquivo contém segredos operacionais. Ele é recuperação do servidor, não arquivo para baixar aberto no computador local. Se for transferido ao Windows, deve entrar diretamente no contêiner criptografado.

## Credenciais: como levar sem expor

Não colocar valores em Markdown, e-mail, chat, GitHub, planilha ou pendrive aberto. No novo computador, registrar em um gerenciador de senhas confiável, em campos separados:

- acesso ao GitHub e eventual token pessoal;
- acesso Hostinger/VPS e console de recuperação;
- acesso do domínio/DNS;
- acesso Meta Business/Dataset EC;
- acesso Z-API/WhatsApp EC;
- acesso Dropi EC e o método 2FA;
- valores existentes nos dois arquivos `.env` acima.

Para SSH, preferir criar uma nova chave `ed25519` no Windows. Antes de devolver o Mac: adicionar apenas a **chave pública** nova na VPS, testar o login Windows, e então remover/revogar a chave pública do Mac. Se for indispensável usar a chave antiga temporariamente, ela deve ficar em contêiner criptografado e ser substituída logo após o teste.

## Verificação depois da transferência

1. Abrir os dois handoffs `MOTOR_EC_HANDOFF_20260711.md` e `.docx`.
2. Confirmar o clone no commit `f36a248` e `git status` limpo.
3. Restaurar `.env` somente na máquina Windows e ajustar dependências com `npm ci`.
4. Testar o SSH novo e verificar na VPS: `pm2 status` e `curl http://127.0.0.1:3001/api/health`.
5. Abrir `https://ec.maxlien.shop/n/` e `https://ec.maxlien.shop/qr.html`.
6. Só após esses testes, remover o acesso do Mac e seguir a política oficial de devolução/limpeza do equipamento.

## Auditoria de integridade em 2026-07-12 UTC

- Git local, GitHub e Git bare da VPS: sincronizados em `f36a248`.
- Nenhum arquivo pendente, stash ou commit não publicado nas duas worktrees locais.
- O único diff após o release executável `d861889` é documentação; não há código de aplicação local sem deploy.
- PM2 está `online`; saúde sem degradação; WhatsApp e Z-API conectados; fila inbound vazia.
- O bundle `EC_CAMADA_1_OBSERVACAO_20260711_210650.bundle` e o `tar.gz` privado foram validados.
- O snapshot runtime acima foi criado e validado por `gzip -t` e SHA-256.
- O `.env` local foi encontrado fora do Git e protegido com permissão `600`.

## Ação de segurança pendente

O histórico antigo do Git contém 16 caminhos de backup de ambiente (`.env.backup`/`.env.bak`). Eles não estão no commit atual, porém podem ter carregado segredos no passado. Tratar as credenciais desses ambientes como potencialmente expostas: rotacionar tokens/senhas, sessões e chaves relevantes após a migração. Uma limpeza de histórico com force-push só deve ser feita em tarefa própria, após backup e coordenação, pois altera referências já usadas pela VPS.
