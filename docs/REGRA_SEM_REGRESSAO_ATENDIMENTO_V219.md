PROJECT=VITALISMEN_EC — VITALISMEN OFICIAL

# Regra de nao regressao da microcamada V219


## Regra permanente de nao regressao — atendimento Vit Power V219

- Evoluir somente o ponto explicitamente autorizado, sobre o baseline publicado em docs/freeze/vitalismen-ec-atendimento-baseline-v218-20261115.json.
- A lista versionada de arquivos permitidos, a comparacao com o parent real e os testes de regressao sao gates obrigatorios. Qualquer delta fora da lista ou teste obrigatorio falhando bloqueia a publicacao.
- Preservar B01 e pausas, formulario/primeiro nome, Comprar depois/ano automatico, dados existentes, pedido/confirmacao/recompra, humano/opt-out, demais produtos, pos-venda, Dropi, Z-API, Pixel/CAPI, precos e VSL. Nao resetar nem liberar contatos em lote.
- Nunca desligar guard, dedupe, lock, historico ou teste para obter PASS. Resultado incerto de envio nao autoriza retry automatico.
- Perguntas tem prioridade sobre avancar etapas: capturar dados comprovados, responder na ordem do cliente e perguntar somente o que falta. Uma pergunta nao autoriza registrar pedido.
- Fonte comercial indisponivel exige explicacao e encaminhamento humano; nao importar promessas de KB antiga.
- Registrar fonte oficial, backup de codigo/configuracao recuperavel, resultados reais, limites e rollback exclusivo da microcamada. Codigo/configuracao nao equivale a backup global MongoDB.
- Autorizacoes ja dadas para este escopo permanecem validas; esta regra nao cria nova rodada de aprovacao. Mudanca de escopo requer instrucao explicita.
- Contrato e testes: docs/REGRA_SEM_REGRESSAO_ATENDIMENTO_V219.md e scripts/guard-freeflow-nonregression-v219.mjs.

## Verificacao e limites

O contrato docs/freeze/freeflow-priority-v219-contract.json declara o parent real e a lista exata de arquivos permitidos. scripts/guard-freeflow-nonregression-v219.mjs rejeita alteracoes fora dela e verifica que formulários estruturados/quantidade, B01, humano, pedido e callbacks permanecem protegidos. Gates de publicacao devem incluir suite senior completa, testes focados, integracao em banco/rede isolados, adulteracao rejeitada e hashes dos arquivos publicos antes/depois. Testes nao provam ausencia de todos os defeitos possiveis; falha ou falta de evidencia obrigatoria bloqueia a etapa correspondente, nunca recebe PASS ficticio.

Precos, formas/prazos/garantia/estoque sem fonte nao sao inventados. A nova capacidade e versionada, inicia limitada e nao libera conversas humanas em lote. A prova real WhatsApp deve ser distinguida de simulacao. Copia de codigo/configuracao nao e backup global MongoDB. Nenhum guard anterior e removido.
