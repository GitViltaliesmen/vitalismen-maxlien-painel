# V129 — armazenamento de uploads manuais e cache

Escopo autorizado pelo operador em 2026-09-04, exclusivamente Vitalismen EC.
Estado deste documento: candidata para staging e gate humano, sem publicação.
Frase necessária para a próxima etapa: `APROVADO STORAGE PARA PUBLICAR`.

## Produção preservada

- CURRENT: `/opt/vitalismen-automacao/current`.
- ACTIVE_RELEASE: `/opt/vitalismen-automacao/releases/20260904T234516Z_production-20260904-ef05d09`.
- ACTIVE_COMMIT: `ef05d0968e1052bef19a9c13146c2c989a1c8658`.
- ACTIVE_TREE: `48eeef3aea6ec6adbeabd46ef45e6b67e13f51c3`.
- PM2_CWD: `/opt/vitalismen-automacao/current`.
- PM2_EXEC: `/opt/vitalismen-automacao/current/src/index.js`.
- PID: `3708736`, online; cwd real confere com a release ativa.
- HEALTH: `https://ec.maxlien.shop/api/health/`, HTTP 200, Z-API conectada,
  Mongo, política `EC_BOT_CORE_OPERATIONAL`, sem motivo de degradação.

O caminho público `/health` pertence a outra rota e retornou 404; a auditoria
usa o health oficial da automação acima. Nenhum ajuste de roteamento foi feito.

## Causa e convenção existente

`ROOT_CAUSE=RUNTIME_MEDIA_AND_CACHE_WRITTEN_INSIDE_IMMUTABLE_RELEASE`.

`src/routes/whatsapp.js` gravava upload manual e cache em
`process.cwd()/public/media`. A metadata de cache conservava um caminho
absoluto da release. Os arquivos funcionais aprovados permanecem íntegros.

A convenção oficial já existe: V30 guarda inbound em `shared/media/inbound`
e V78 guarda artefatos em `shared/runtime`. A candidata utiliza os mesmos
diretórios estruturais, com filhos separados:

- PERSISTENT_MEDIA_PATH: `/opt/vitalismen-automacao/shared/media/uploads`.
- RUNTIME_CACHE_PATH: `/opt/vitalismen-automacao/shared/runtime/remote-media-cache`.
- EXISTING_STORAGE_CONVENTION_USED: YES.

Não há novo serviço, banco, esquema, transporte, engine ou diretório estrutural
paralelo. A convenção local de testes continua em `.runtime`, conforme V30/V78.
Em produção não há fallback de escrita para a release. A validação de symlinks
reutiliza a função V78; o algoritmo de fingerprint não foi alterado.

## Preservação dos sete arquivos

Backup protegido: `/opt/vitalismen-automacao/backups/v129-storage-20260905T010000Z`.
O sufixo identifica o diretório; timestamps reais estão nas evidências JSON.

- `inventory-before.json`: path, size, SHA256, owner, mode, mtime, ctime e
  Message/providerMessageId associados, coletados antes das cópias.
- `quarantine/public/media/...`: sete backups protegidos, com mtime preservado.
- `preservation-result.json`: hashes de original, backup e cópia persistente.
- `simulation-result.json`: restauração exata do fingerprint em cópia isolada.
- `url-simulation-result.json`: sete URLs públicas comparadas com Nginx isolado.
- `operational-readonly.json`: identidade operacional, QA e três produtos.

Todos os originais são root:root, modo 0644. As cópias persistentes preservam
modo, mtime, tamanho e conteúdo. Quarantine usa 0600, dentro de diretório 0700.
Foram confirmados SHA256 iguais e comparação byte a byte em 7/7 arquivos.
Mongo não recebeu escrita de migração. Os originais não foram removidos.

| Arquivo relativo a public/media | Bytes | SHA256 |
| --- | ---: | --- |
| uploads/1788566698625_ab9c67071f17.mp3 | 12581 | 0ec8fa27faf87250ef832250599354ff8c9779e3b2b8623a7594e7c47000a11c |
| remote-cache/8a1dcded61fe9c4e50ee02d085c142fb1d8775bce59b79b252227a9aa863c62a.webp | 48534 | 2ceb1a543d1b393a8bbbca16c6817565a0ab695adbc4d94c2aa45d09e12419c0 |
| remote-cache/8a1dcded61fe9c4e50ee02d085c142fb1d8775bce59b79b252227a9aa863c62a.json | 422 | c28a0d535e0245048ddf5a52b33dc0bd7f440d5b8db6cca8669a128bc51bc6d5 |
| remote-cache/b2f7fd17b756e46828d8cfef325d75d692071e3f23eab43af8bffbdf2ca0f7d3.webp | 280060 | 8eba7d9b099fc0f417949dae9b92ed519ea1c079c60606bb747d20cc0c11c31d |
| remote-cache/b2f7fd17b756e46828d8cfef325d75d692071e3f23eab43af8bffbdf2ca0f7d3.json | 422 | ce01fd188ef03a28f4283018a44d1bfa712d0386375568e19f15be67e3f93a02 |
| remote-cache/19321cecaf7f959bf4b4a1ce795ae0a1fd331413903ddfa0231d958ef587c62f.jpg | 349640 | df2790b7253667b84b6d9f088a80c412ac15d8d86025d91635893e7069c163a4 |
| remote-cache/19321cecaf7f959bf4b4a1ce795ae0a1fd331413903ddfa0231d958ef587c62f.json | 420 | b0b6ebf4a52c0b188b924e0bdcf7a95e48850a5b16632c4397505a698cc13986 |

O áudio conserva `providerMessageId=3EB03D53D5F496CA86A239`, timestamp
1788566699, tipo audio, isFromMe=true e senderRole=human. Os três pares de
cache têm referências Message inventariadas; suas metadatas não são reescritas.
O código resolve o basename no cache externo, independente do path antigo.

## Microdiff

Arquivos da aplicação:

1. `src/services/manualMediaStorageV129Service.js`: resolução dos dois destinos,
   conversão da URL lógica e leitura do cache preservado.
2. `src/routes/whatsapp.js`: troca dos destinos e compatibilidade de leitura/
   reutilização das mesmas URLs `/media/uploads/...`; +13/-6 linhas.
3. `src/index.js`: montagem dos dois diretórios externos nas mesmas URLs;
   +7/-0 linhas, demais bytes preservados.

Configuração operacional preparada: `ops/nginx-v129-storage-locations.conf`.
São duas locations de arquivos no Nginx existente. Isso mantém URLs de mídias
já persistidas mesmo quando o aplicativo retorna a uma release anterior.
A configuração foi executada em instância isolada ligada só a 127.0.0.1 e
encerrada; a configuração e o processo Nginx de produção não foram alterados.

Suporte: manifesto próprio de storage, guard, registro no carregador V97,
reconhecimento dos hashes sucessores pelo guard B, teste de integridade auth
e testes de armazenamento. Manifestos ancestrais não foram editados. O teste
reconstrói o index sem os sete acréscimos e exige seu SHA256 aprovado original,
preservando a verificação de auth/rate limiter.

Base local: commit `5257a5b8b13bbb5a367618888c32b9e335b49024`, que já contém a
correção exclusiva de validação V127 apresentada anteriormente. A nova candidata
inclui essa correção de teste; a aplicação base continua equivalente à ef05d09.

Não foram alterados read state, unread/unanswered, schema, classificação de echo,
parser Z-API, Dropi, pós-venda, funil, VSL, Meta, preço ou rótulo visual “bot”.
`public/qr.html`, os serviços de leitura/eco e os arquivos funcionais Dropi
foram comparados byte a byte com ef05d09.

## Evidência antes do gate

- Simulação retirou exclusivamente os sete arquivos da cópia isolada; a árvore
  Git publicada não contém uploads/cache nesses diretórios.
- Fingerprint restaurado: `24ad2fbe423208cc305787e4821866329772663382ee879ee16e3bcfd5a76133`,
  exatamente o original aprovado. Nenhuma exclusão nova no algoritmo.
- Fingerprint da produção preservada: `9350cfcdf9be1eb18f0107824101e29e7c67f56fd049c344d1df1ab552515c6a`;
  ainda inclui os sete originais até o gate. Não declarar a produção corrigida.
- Sete URLs antigas HTTP 200; sete URLs no Nginx isolado HTTP 200, SHA256 e
  bytes iguais; áudio HTTP 206 para Range e decodificação FFmpeg sem erro.
- Testes locais: upload executa o ramo real da rota com transporte simulado;
  cache executa seu handler com upstream simulado e reaproveita a segunda leitura.
- Servidor HTTP de teste reiniciado para candidate/next/rollback, com a mesma
  URL, MIME, bytes e resposta parcial. Isso não equivale a restart PM2 real.
- Produtos públicos autenticados: Tex Ultra, Nitrix e Vit Power habilitados;
  autorização manual exigida, directAutomaticSend=false.
- QA: Order=0, Shipment=0, metadata.testOnly=true. Nenhum envio WhatsApp, Dropi,
  Purchase Meta ou CAPI foi disparado nesta preparação de storage.

O senior na produção passou usando o preload V97 do helper oficial. Invocações
iniciais sem esse contexto, ou apenas com V89, falharam por herança de guards;
não houve edição para suprimi-las. Na worktree nova faltava instalação local de
libsignal; `npm ci --omit=dev` instalou o lockfile existente, sem mudar dependências.
A worktree também recebeu a configuração local de testes já validada na V129,
depois de o senior apontar sua ausência; nenhum segredo foi incluído no Git.

Validação final concluída, sem skips:

- `npm test`: 758/758, exit 0.
- `senior:check`, incluído na execução completa: 497/497, exit 0.
- Regressões dirigidas de storage, V129 A/B, auth, V114/V115/V116/V118 e
  recuperação de outbound/multiturno: 76/76, exit 0.
- `npm run lint`: 788 arquivos, exit 0.
- `git diff --check`: PASS.
- Senior no VPS atual: PASS; guard obrigatório no caminho legado: PASS.

Microdiff funcional da aplicação: 3 arquivos, +65/-6 linhas, incluindo o novo
serviço de 45 linhas. Configuração Nginx proposta: 14 linhas adicionais.
Carregador/guards/testes/documentação são suporte de validação e publicação.
Commit/tree e attestation de staging acompanham o gate após este registro.

## Sequência executável somente após aprovação STORAGE

1. Conferir commit/tree exatos aprovados e attestation de staging. Fotografar
   PM2, ambiente, banco, Nginx e fingerprints antes da janela.
2. Revalidar inventário, byte a byte e ausência dos sete arquivos na árvore
   publicada. Qualquer arquivo novo exige novo inventário/backup; não apagar
   por glob nem alterar os arquivos versionados.
3. Publicar a tag exata pelo helper V70, sem ainda trocar current.
4. Instalar somente as duas locations de mídia no server TLS EC, com backup
   do arquivo oficial, `nginx -t`, reload e HTTP/Range/hashes conferidos.
5. Parar somente `vitalismen-automation` para impedir escrita concorrente de
   cache/upload durante a restauração da origem. O helper suporta explicitamente
   `STOPPED_CONTAINMENT`. Registrar janela breve de indisponibilidade da API.
6. Remover da release somente os sete paths inventariados após reconfirmar
   backup/cópia persistente, hashes, timestamps posteriores à publicação e
   ausência na árvore publicada. Validar fingerprint original exato.
7. Preflight, permit temporário, activation-validate, activate-safe pelo helper;
   restaurar perfil operacional completo pelo helper V78. Verificar cwd real,
   exec, flags, health, Mongo/Nginx e PM2 save. Nenhum helper será editado.
8. Revalidar URLs antigas; enviar exatamente um áudio QA autorizado e verificar
   path externo, provider echo, mensagem humana única e fingerprint invariável.
9. Operador envia **do celular QA** para o número oficial `QA V129 INBOUND 2`,
   com conversa fechada até capturar a reabertura. Atender, observar 0/0, refresh
   e background sync. O outbound anterior `QA V129 entrada 2` não vale como inbound.
10. Conferir todos os gates e zero efeitos comerciais QA antes de freeze final.

Rollback nesta etapa é somente simulado/read-only. As URLs existentes ficam
independentes da release por Nginx e shared. Retomar runtime anterior sem o patch
de escrita pode reintroduzir o defeito; não executar rollback operacional cego.
Se a ativação falhar, aplicar a contenção oficial e preservar mídias e histórico.

`PRODUCTION_CHANGED=NO` para release, PM2, flags, código ativo, Mongo e Nginx.
Foram criados apenas backups e cópias externas preservadas, além do staging.
`OPERATOR_APPROVAL_REQUIRED=STORAGE`.
Nenhuma tag de freeze final deve ser criada nesta etapa.
