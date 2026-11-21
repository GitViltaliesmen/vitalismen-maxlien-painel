# VITALISMEN_EC — Catálogo Servientrega Ambato V255

## Fonte funcional publicada

- Commit: `02dccb3ea4604732c23aec1c82c8766789ceb4e6`.
- Árvore: `7a069f80153d1d6f105f30d9ea173ba4ec83b483`.
- Branch: `codex/ec-servientrega-ambato-v255-20261120`.
- Parent de produção: V254 `05f23b13cd89385a3cfdbdaf6c27d58f17384516`.
- Release ativo: `/opt/vitalismen-automacao/releases/20261121T031500Z_production-20261121-02dccb3`.

O delta selado contém apenas `src/data/agencia_LISTA.json`, o preload V255 e o controlador de reinício PM2 necessário para carregar o novo verificador. O painel `public/qr.html`, pedidos, Meta, Dropi, VSL e funis não tiveram delta funcional. A autoridade selada está em `/var/lib/vitalismen-deploy/sealed-successors-v1/02dccb3ea4604732c23aec1c82c8766789ceb4e6.json` e o estado operacional em `/var/lib/vitalismen-deploy/ec-servientrega-ambato-v255-r1`.

O arquivo do catálogo passa de 592 a 598 registros. Todos os 592 registros anteriores permanecem idênticos por comparação de multiconjunto; foram acrescentadas apenas as seis agências listadas no [manifesto V255](../../../docs/freeze/ec-servientrega-ambato-v255-20261120.json). A cópia anterior está em `/opt/vitalismen-automacao/backups/ec-servientrega-ambato-v255-20261121/agencia_LISTA.before.json` com SHA-256 `0b3a6dc90fc347452bc63d5f244ba4adc2cfa83f5e03c80b49a57751c637ebc1`.

## Verificação e ativação

- Prova isolada do selo: `V255_SEAL_PASS`, três arquivos permitidos.
- Pré voo: fonte remota exata, V254 online, fila inbound vazia e pós venda ocioso.
- Ativação: `activation-controller.py` retornou `PASS_ACTIVE_V255`; PM2 mudou de PID `763393` para `765564`.
- Pós publicação: `current`, `pm_cwd` e `/proc/765564/cwd` apontaram para o V255; `/api/health` respondeu HTTP 200/online; as seis buscas em `/api/shipments/servientrega/ec/agencies` retornaram as agências; timer de pós venda permaneceu ativo.
- O executor agendado de pós venda V254 exigia o release antigo. O drop-in V255 preserva o anterior, aponta para `post-sale-controller.py` com SHA-256 `b9396f4fc8ecb32741c051199638216efe6f908f4d82c7cd29d538ba4fc64d21` e mantém lock, renovação de sessão, provas operacionais, perfil selado, recibos e limite de uma saída física por ciclo. Snapshot e dry-run V255 passaram com zero envios. A primeira execução agendada concluiu `PASS_DEFERRED_OUTSIDE_EC_WINDOW` em `2026-11-21T03:40:00.897Z`, com zero saídas e recibo em `/var/lib/vitalismen-deploy/ec-servientrega-ambato-v255-r1/post-sale-receipts/POSTSALE_run_0cf657e6c5.json`. Ela valida o agendamento, mas não comprova envio físico em janela comercial.
- A primeira tentativa V255 falhou pelo ambiente herdado do PM2, retornou ao V254 e a API recuperou HTTP 200 antes da correção do controlador e da ativação final.

O controlador é específico para o V255 e exige o parent V254, os hashes, a branch exata, a fila vazia e o timer preservado. Ele restaura o symlink e o estado V254 se a ativação ou a checagem da API falhar. Um rollback futuro exige nova observação das filas e efeitos externos; não repetir operações externas incertas nem apagar recibos. O backup do catálogo e do código não equivale a backup global MongoDB.

O teste amplo `npm run senior:check` já falhava no parent V254 pela herança inalterada de `.github/workflows/ec-panel-quality.yml`. Não foi usado para liberar o V255. Os gates selados e a verificação funcional direcionada foram usados para esta publicação.
