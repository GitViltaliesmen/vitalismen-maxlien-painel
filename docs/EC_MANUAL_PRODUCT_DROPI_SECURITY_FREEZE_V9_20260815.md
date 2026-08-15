# Suplemento congelado EC v9: permissao da sessao Dropi

Data: 2026-08-15

Esta microcamada sucede o hotfix v8 sem alterar sua politica de produto, tabela de precos, funis ou pedidos. Ela corrige somente a permissao do arquivo de sessao autenticada Dropi.

Depois de cada gravacao feita pelo servico ou pelo utilitario de sessao, `droppi-ec-storage.json` recebe modo `0600`. Somente o usuario proprietario pode ler ou escrever o arquivo. O caminho continua fora dos releases, em `~/.vitalismen-secrets`.

O freeze v8 e todos os freezes anteriores permanecem intactos. O rollback de aplicacao continua sendo a release v5 registrada no documento v8; a permissao operacional `0600` nao deve ser revertida durante rollback.
