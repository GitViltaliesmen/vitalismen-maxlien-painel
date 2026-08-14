# Extensão WhatsApp — padronização segura de dados

Data: 2026-08-14.

Versão: `0.13.5`.

## Objetivo

Padronizar os dados captados pela ficha do cliente e tornar a busca de agências mais segura, sem alterar o motor de envio, os funis congelados, preços, pedidos, campanhas ou integrações operacionais existentes.

## Alterações realizadas

- nomes passam a usar iniciais maiúsculas, preservando conectores internos em minúsculas;
- o nome declarado pelo cliente ou já salvo na ficha tem prioridade sobre o nome de exibição do WhatsApp;
- cidade e província são apresentadas com capitalização consistente;
- o catálogo local preenche a província somente quando a cidade possui correspondência única e exata;
- nomes de cidade com complemento entre parênteses, como `Salinas (Santa Elena)`, aceitam o nome-base `Salinas`;
- cidade desconhecida, incompleta ou ambígua não recebe província e não mostra agências de outro local;
- espaços duplicados em referência e endereço são removidos sem reescrever o conteúdo informado pelo cliente;
- versão do manifesto, release, painel, lançador e testes foi alinhada em `0.13.5`.

## Comportamentos preservados

- nenhum envio de WhatsApp é disparado automaticamente;
- os botões de envio de agência continuam exigindo clique humano;
- confirmação de pedido e envio operacional continuam exigindo ação humana;
- motor interno de transporte permanece na revisão congelada `0.11.5`;
- funis, textos, áudios, mídias, preços, produtos, sequência e tempos congelados não foram alterados;
- VSL, campanhas, atribuição, backend e pedidos existentes não foram alterados nesta etapa.

## Validações executadas

- `node --check` nos quatro arquivos JavaScript alterados: aprovado;
- testes específicos do normalizador, extração, cidade/província e integridade da release: `4/4` aprovados;
- suíte completa `node --test`: `49/49` aprovada;
- `npm run senior:check`: aprovado;
- `npm run guard:whatsapp-status-contacts`: aprovado, camada isolada e sem disparos;
- `npm run guard:freeze-lock`: `19/19` regras congeladas preservadas;
- `npm run audit:customer-draft-zero`: `27/27` verificações aprovadas;
- `git diff --check`: aprovado.

## Recuperação

- commit-base preservado: `42e374633abe02882fb4d12c6ded96b0feb1bb03`;
- tag de segurança: `backup-extension-v0.13.4-before-standardization-20260814`;
- cópia integral da pasta carregada antes da atualização:
  `.codex-tmp/extension-backups/CARREGAR_ESTA_PASTA_FUNIL_FLUTUANTE_V051-before-standardization-20260814.zip`;
- SHA-256 do backup: `223D5EBC2CD2D259C2FB8C808ECAAA33DCD4B36083EC49D6936E0D342C54D576`.

## Pacote preparado

- pasta local carregada sincronizada: `CARREGAR_ESTA_PASTA_FUNIL_FLUTUANTE_V051`;
- pacote: `.codex-tmp/extension-releases/Vitalismen-WhatsApp-Oficial-v0.13.5-20260814-012505.zip`;
- SHA-256: `7F4204361700A45CC5D5C64C27C690BCE4E1DBE29D0DAA0D1EC55D1C4091FBC0`;
- fonte oficial e pasta carregada possuem os mesmos 111 arquivos e o mesmo conteúdo, desconsiderando somente a convenção de quebra de linha em dois arquivos preservados.

Para rollback, restaurar a cópia acima na pasta carregada e usar uma única vez o botão `Atualizar` da extensão no Chrome.
