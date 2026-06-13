# Plano de Ajustes - Funil Cliente Real Vit Power

Data: 2026-05-22

Status: plano de trabalho. Nao altera funil, codigo, audios ou VPS por si so.

## Regra Mae

Trabalhar uma fase por vez:

1. congelar antes;
2. alterar escopo pequeno;
3. testar no 8637;
4. auditar cliente real/registro;
5. congelar;
6. so entao passar para a proxima fase.

Nunca misturar em uma mesma etapa:

- quantidade fora do padrao;
- objecao/FAQ;
- pos-venda;
- agencia natural;
- LID/audio/imagem/link sem resposta.

## Base Atual Encontrada

Auditoria real congelada:

- 179 mensagens;
- 16 conversas/clientes;
- 15 pedidos tocados/atualizados;
- janela 21/05/2026 21:00 BRT ate 22/05/2026 09:58 BRT.

Principais quebras reais:

- cliente pergunta uso antes da venda;
- cliente pergunta se funciona/serve para ele;
- cliente pergunta diabetes, pressao alta, medicacao ou contraindicacao;
- cliente pede 2 ou 4 frascos;
- cliente pede desconto/rebaixa;
- cliente manda agencia em linguagem natural;
- cliente pos-venda pergunta como tomar;
- inbound por audio/imagem/link/LID pode ficar sem resposta.

## Audios Encontrados e Uso Recomendado

### Inicio / apresentacao

- `01_B_Buenos_dias`
- `01_C_Buenos_tardes`
- `01_A_buenas_noches`
- `TRATAMENTO_Y_PRECIOS_PROMOCAO`
- `PRODUTO`
- `PRODUDO_LIQUIDO_X_CAPSULA_MELHOR`

Uso: funil inicial aprovado. Nao mexer salvo escopo explicito.

### Quantidade / oferta

- `3_BOTELLAS_POR_95_E_99`
- `6_BOTELLAS_POR_167_E_99`
- `TRATAMENTO_Y_PRECIOS_PROMOCAO`
- `QUANTOS_FRASCOS_E_DIA_QUERES`

Atualizacao aprovada: nao existe audio oficial para 2 ou 4 frascos. Para 2 frascos, usar texto curto com excecao aprovada de 70 USD quando o cliente pedir. Para 4 ou outras quantidades, redirecionar para 1, 3 ou 6, sem inventar preco.

### Uso / como tomar / tempo

- `COMO_SE_TOMA_VIT_POWER`
- `COMO_TOMAR_VIT_POWER_SEM_REFERENCIA_QUANTIDADE_LITRO`
- `TEMPO_RESULTADO_VIT_POWER`
- `TRATAMENTO_CONTINUA_NAO_EFEITO_IMEDIATO`

Uso: FAQ interrupt e pos-venda, com cuidado para nao reabrir funil de venda.

### Funciona / serve para mim / prova

- `FUNCIONA_VIT_POWER`
- `FUNCIONA_TRATAMENTO_COMPLETO_100_NATURAL`
- `DEPOIMENTO_AUDIO_PRODUTO`
- `100_NATURAL_SEM_CONTRA_INDICACAO`

Uso: duvida leve, prova, medo se funciona. Para contraindicao, usar texto seguro antes de qualquer audio que soe absoluto.

### Saude / prostata / cirurgia

- `Ajuda_Prostata`
- `PROSTADA_FUNCIONA_E_QUANDO_CHEGA`
- `RECOMENDACOES_PARA_CLIENTE_QUE_PASSOU_POR_CIRURGIA_PROPOSTA`
- `100_NATURAL_SEM_CONTRA_INDICACAO`

Uso: perguntas de saude exigem texto de seguranca. Nao prometer cura e nao dizer que serve para todos.

### Agencia / domicilio / logistica

- `PERGUNTA_AGENCIA_DOMICILIO`
- `AGENCIA`
- `ENDERECO_CIDADE_PROVINCIA_AGENCIA`
- `ESCOLHA_UMA_AGENCIA_ACIMA`
- `DOMICILIO`
- `DOMICILIO_A_AGENCIA_DE_SERVIENTREGA`
- `QUANDO_CLIENTE_PEDIR_A_DOMICILIO_REFERENCIA_COMPLETA`
- `ENDERECO_ORIENTACAO`
- `ENTREGAS_A_SERVIENTREGAS_MELHOR_OPCAO`
- `ENVIO_AGENCIA_100_SEGURO`
- `ENTREGA_SEGURA_RETIRE_NA_AGENCIA`
- `SUGESTAO_ENTREGA_EM_SERVITREGA_01_QUANDO_CLIENTE_NAO_COLOCA_ENDERECO`
- `TEMPO_DEMORA_PRODUTO_CHEGAR`

Uso: fase logistica congelada. Agencia natural deve ser fase propria, por tocar bloco sensivel.

### Fechamento / guia / retirada / bonus

- `Agradecimento_Agencia_01`
- `AGRADECIMENTO_AGENCIA_DE_ENTREGA`
- `BONUS_RETIRADA`
- `Informativo_Ana_Lopes_pedido_Em_fase_entrega`
- `PEDIDO_ENVIADO`
- `GUIA`
- `CONFIRMACION_Y_REGALITO_ESPECIAL`
- `Chegou_01`
- `Chegou_02`
- `Chegou_03`

Uso: nao mexer junto com FAQ/quantidade. Pos-venda "como tomar" deve ser fase propria.

### Ligacao / pessoal / bordas

- `CLIENTES_QUE_LIGAM`
- `QUANDO_CLIENTE_INSISTE_EM_LIGAR`
- `QUANDO_CLIENTE_LIGA_01`
- `INFORMACOES_PESSOAIS_NAIS`
- `INFORMACOES_PESSOAS_NAIS`

Uso: complemento lateral, sem avançar funil.

## Perfis de Cliente - Motor de Decisao

Objetivo: antes de escolher a resposta, identificar o tipo de cliente pelo que ele escreveu. O perfil nao substitui o funil. Ele escolhe a melhor camada lateral, o melhor audio e o melhor retorno para a etapa atual.

Campos ja previstos para memoria:

- `profile_type`;
- `buyer_score`;
- `last_objection`;
- `conversation_summary`;
- `stage`.

Regra de implementacao: primeiro estabilizar respostas por perfil em testes; depois gravar `profile_type` e `buyer_score` no painel/memoria. Nao gravar perfil antes de validar que a resposta nao contamina o funil.

### Perfil 1 - Cliente Quente

Sinais reais:

- pergunta preco;
- pergunta promocao;
- pergunta quanto custa;
- escolhe quantidade;
- manda dados ou confirma.

Grafias provaveis:

- "precio?"
- "precios"
- "cuanto cuesta?"
- "cuanto vale?"
- "valor?"
- "promo"
- "promocion"
- "quiero comprar"
- "quiero pedir"
- "me interesa"
- "deseo el producto"
- "quiero 1"
- "quiero 3"
- "quiero 6"

Estrategia:

- responder rapido;
- prova curta;
- levar para escolha de quantidade;
- nao abrir explicacao longa.

Fluxo recomendado:

1. audio de horario, se for primeira entrada;
2. prova curta;
3. apresentar 1 frasco por 39 USD;
4. apresentar 3 frascos por 95.99 USD;
5. apresentar 6 frascos por 167.99 USD quando fizer sentido;
6. perguntar quantidade.

Audios/midias:

- `01_B_Buenos_dias`, `01_C_Buenos_tardes`, `01_A_buenas_noches`;
- `TRATAMENTO_Y_PRECIOS_PROMOCAO`;
- `3_BOTELLAS_POR_95_E_99`;
- `6_BOTELLAS_POR_167_E_99`;
- prova social curta quando ainda nao enviada.

Texto base:

> Claro. Hoy la promocion oficial esta asi: 1 frasco por 39 USD, 3 frascos por 95.99 USD y 6 frascos por 167.99 USD. Con cual opcion desea empezar?

### Perfil 2 - Cliente Desconfiado

Sinais reais:

- pergunta se funciona;
- pergunta se e verdade;
- medo de golpe;
- pede prova;
- pergunta se e confiavel.

Grafias provaveis:

- "funciona?"
- "si funciona?"
- "de verdad funciona?"
- "es verdad?"
- "es real?"
- "no es estafa?"
- "es confiable?"
- "tiene garantia?"
- "tiene pruebas?"
- "manda testimonios"
- "no confio"

Estrategia:

- prova social;
- depoimento;
- seguranca de entrega;
- reduzir medo;
- voltar para escolha de quantidade ou proximo dado.

Fluxo recomendado:

1. `social_01`;
2. `social_02`, se ainda nao enviado e se a etapa permitir;
3. `DEPOIMENTO_AUDIO_PRODUTO`;
4. `FUNCIONA_VIT_POWER`;
5. `ENVIO_AGENCIA_100_SEGURO`;
6. pergunta simples de avanco.

Texto base:

> Le entiendo. Por eso trabajamos con prueba social y entrega segura por agencia Servientrega, para que usted revise antes y pague al recibir. Le envio una prueba corta y seguimos paso a paso.

### Perfil 3 - Cliente Social

Sinais reais:

- pergunta sobre Ana;
- tenta criar vinculo pessoal;
- pergunta se e casada, onde vive, a que se dedica;
- quer conversa antes de compra.

Grafias provaveis:

- "eres casada?"
- "estas casada?"
- "tienes esposo?"
- "a que te dedicas?"
- "donde vives?"
- "de donde eres?"
- "cuantos anos tienes?"
- "mandame foto"

Estrategia:

- responder leve;
- criar vinculo sem expor vida pessoal;
- voltar ao produto/funil;
- nao alimentar conversa pessoal longa.

Audio:

- `INFORMACOES_PESSOAIS_NAIS`;
- `INFORMACOES_PESSOAS_NAIS`, se for a versao usada no painel.

Texto base:

> Si, tengo mi familia y trabajo ayudando clientes junto al equipo de la doctora Maria Fernandes. Y cuenteme algo: usted busca mas energia o mas confianza?

### Perfil 4 - Cliente Sexualmente Frustrado

Sinais reais:

- fala perda de desempenho;
- fala que nao e mais o mesmo;
- fala que nada funciona;
- baixa autoestima.

Grafias provaveis:

- "ya no soy el mismo"
- "ya no soy como antes"
- "nada me funciona"
- "no tengo energia"
- "no tengo ganas"
- "no tengo confianza"
- "me siento mal"
- "me da verguenza"
- "mi mujer se queja"
- "fallo mucho"

Estrategia:

- autoestima;
- esperanca realista;
- masculinidade sem exagero;
- confianca;
- nao prometer milagre.

Fluxo recomendado:

1. texto emocional curto;
2. `FUNCIONA_TRATAMENTO_COMPLETO_100_NATURAL`;
3. `TEMPO_RESULTADO_VIT_POWER`;
4. `DEPOIMENTO_AUDIO_PRODUTO`;
5. pergunta simples de quantidade ou interesse.

Texto base:

> Le entiendo, senor. A muchos hombres les pasa que sienten que ya no tienen la misma energia, confianza o disposicion de antes. Lo importante es empezar con calma y constancia, sin prometer milagros.

### Perfil 5 - Cliente Logistico

Sinais reais:

- pergunta agencia;
- pergunta domicilio;
- pergunta entrega;
- pergunta demora;
- fala uma cidade/agencia/referencia.

Grafias provaveis:

- "agencia?"
- "servientrega?"
- "domicilio?"
- "entrega a casa?"
- "cuanto demora?"
- "cuando llega?"
- "donde retiro?"
- "retirar en agencia"
- "ahi retiro"
- "la agencia cercana"
- "Palestina"
- "frente a la comision de transito"

Estrategia:

- facilitar entrega;
- sugerir agencia proxima;
- aumentar retirada;
- pedir cidade/provincia quando faltar;
- nao saltar bloco A/B/C sem fase propria.

Fluxo recomendado:

1. `PERGUNTA_AGENCIA_DOMICILIO`;
2. `ESCOLHA_UMA_AGENCIA_ACIMA`;
3. `ENTREGA_SEGURA_RETIRE_NA_AGENCIA`;
4. `BONUS_RETIRADA` apenas depois do fechamento, nunca antes.

Observacao: agencia natural fica em fase separada porque toca bloco congelado de logistica.

### Perfil 6 - Cliente "Para Que Serve o Produto?"

Sinais reais:

- pergunta para que serve;
- pergunta o que faz;
- nao se identifica com produto;
- precisa entender beneficio emocional.

Grafias provaveis:

- "para que sirve?"
- "pa que sirve?"
- "que hace?"
- "que es eso?"
- "que tiene que ver conmigo?"
- "en que ayuda?"
- "para que es?"
- "eso para que es?"
- "me explica"

Estrategia:

- nao falar tecnico demais;
- falar beneficio emocional;
- falar energia, confianca, disposicao;
- conectar com masculinidade sem vulgaridade;
- pergunta simples ao final.

Fluxo recomendado:

1. texto curto;
2. `FUNCIONA_VIT_POWER`;
3. `PRODUDO_LIQUIDO_X_CAPSULA_MELHOR`;
4. pergunta simples.

Texto base:

> Senor, Vit Power esta pensado para hombres que sienten que ya no tienen la misma energia, confianza o disposicion de antes. Muchos empiezan buscando sentirse nuevamente mas seguros, mas activos y con mejor animo en la intimidad. Usted busca mas energia o mas confianza?

### Perfil 7 - Cliente Saude Cuidadoso

Sinais reais:

- diabetes;
- pressao alta;
- pressao baixa;
- hipertenso;
- medicamento;
- cirurgia;
- coracao;
- rim/rins;
- figado;
- alergia;
- efeito secundario;
- medo de contraindicacao.

Grafias provaveis:

- "tengo diabetes"
- "soy diabetico"
- "soy diabetico"
- "tengo azucar"
- "tengo glucosa"
- "tengo presion alta"
- "tengo presion baja"
- "tengo tension alta"
- "soy hipertenso"
- "soy hispertenso"
- "tomo medicamentos"
- "tengo medicacion"
- "tomo pastillas"
- "tomo medicina"
- "tomo remedios"
- "uso insulina"
- "tomo metformina"
- "tomo losartan"
- "tomo enalapril"
- "tomo aspirina"
- "uso anticoagulante"
- "tengo problema del corazon"
- "soy cardiaco"
- "tuve infarto"
- "tuve cirugia"
- "estoy operado"
- "me operaron"
- "tengo problema del rinon"
- "tengo problema renal"
- "tengo problema del higado"
- "soy alergico"
- "me hace dano?"
- "me puede hacer mal?"
- "tiene efectos secundarios?"
- "contraindicaciones?"
- "contraindicacion"
- "es contraindicado?"

Estrategia:

- seguranca primeiro;
- orientar consultar profissional;
- nao prometer cura;
- nao dizer que serve para todos;
- se continuar interessado, voltar suavemente para informacao geral.

Audios:

- usar texto seguro obrigatorio;
- `RECOMENDACOES_PARA_CLIENTE_QUE_PASSOU_POR_CIRURGIA_PROPOSTA` quando for cirurgia;
- `100_NATURAL_SEM_CONTRA_INDICACAO` obrigatorio nesta etapa, sempre depois do texto seguro.

Texto base:

> Le entiendo, señor. Si tiene diabetes, presion alta, problema del corazon, higado o riñon, si fue operado o si usa medicamentos, lo correcto es confirmar primero con su medico o farmaceutico de confianza antes de usar cualquier suplemento. No le voy a decir "si, tomelo" sin esa confirmacion. Si su profesional lo autoriza, con gusto seguimos con la informacion del pedido.

### Perfil 8 - Pos-venda

Sinais reais:

- ja comprou;
- ja retirou;
- ja recebeu guia;
- pergunta como tomar;
- pergunta guia/retirada;
- quer comprar de novo.

Grafias provaveis:

- "ya retire"
- "ya compre"
- "ya me llego"
- "como lo tomo?"
- "como se toma?"
- "cuando tomo?"
- "quiero otro pedido"
- "quiero comprar de nuevo"

Estrategia:

- ajudar sem reabrir venda;
- manter trava pos-fechamento;
- recompra so depois de entregue/retirado conforme Dropi;
- nao apagar historico.

Audios:

- `COMO_SE_TOMA_VIT_POWER`;
- `TEMPO_RESULTADO_VIT_POWER`;
- audios de guia/retirada conforme status: `Chegou_01`, `Chegou_02`, `Chegou_03`, `CONFIRMACION_Y_REGALITO_ESPECIAL`.

## Matriz de Fases

### Fase 0 - Motor de Perfis

Status: planejamento. Nao implementar antes de testar as respostas por perfil.

Objetivo:

- classificar o cliente pelo texto real;
- escolher audio/resposta lateral adequada;
- manter a etapa principal do funil intacta;
- gravar `profile_type`, `buyer_score` e `last_objection` somente depois que os comportamentos estiverem validados.

Ordem de prioridade do perfil quando houver sobreposicao:

1. `POS_VENDA`, se ja existe pedido fechado/guia/retirada;
2. `SAUDE_CUIDADOSO`, se menciona diabetes, pressao, medicamento, cirurgia ou contraindicacao;
3. `LOGISTICO`, se fala de agencia, domicilio, guia, retirada ou prazo;
4. `QUENTE`, se fala de preco, quantidade, compra ou dados;
5. `DESCONFIADO`, se pergunta se funciona, se e real, prova, golpe ou garantia;
6. `CLIENTE_SEXUALMENTE_FRUSTRADO`, se fala perda de desempenho, autoestima ou intimidade;
7. `CLIENTE_PARA_QUE_SERVE`, se pergunta o que e, para que serve ou como ajuda;
8. `SOCIAL`, se pergunta da vida pessoal de Ana.

Regra: se uma mensagem tiver saude + compra, saude responde primeiro; depois volta para compra. Se tiver pos-venda + compra nova, a trava pos-venda decide antes de qualquer perfil comercial.

### Fase 1 - FAQ Interrupt Uso e Saude

Status: aplicada e congelada como camada lateral. A Fase 1 responde duvidas reais sem mudar etapa principal do funil.

Separacao obrigatoria:

- Uso/tempo: responde uso, dose, frequencia e tempo de resultado.
- Saude sensivel: responde com texto seguro primeiro e audio obrigatorio de apoio, sem liberar uso para todos.

Casos de uso/tempo:

- "como tomar"
- "como se toma"
- "cuantas veces al dia"
- "dosis"
- "es temporal"
- "por cuanto tiempo"

Casos de saude sensivel:

- "tengo diabetes"
- "soy diabetico"
- "tengo azucar"
- "tengo glucosa"
- "tengo presion alta"
- "tengo presion baja"
- "soy hipertenso"
- "soy hispertenso"
- "tomo pastillas"
- "tengo medicacion"
- "tomo remedios"
- "uso insulina"
- "tomo metformina"
- "tomo losartan"
- "tomo enalapril"
- "tomo aspirina"
- "uso anticoagulante"
- "sufro del corazon"
- "soy cardiaco"
- "tuve infarto"
- "estoy operado"
- "tuve cirugia"
- "me operaron"
- "tengo problema del rinon"
- "tengo problema renal"
- "tengo problema del higado"
- "soy alergico"
- "me hace dano?"
- "me puede hacer mal?"
- "tiene efectos secundarios?"
- "contraindicacion"
- "contraindicaciones"

Audios por tipo:

- uso/dose: `COMO_SE_TOMA_VIT_POWER`
- tempo/resultado/temporal: `TEMPO_RESULTADO_VIT_POWER`
- saude sensivel/contraindicacao: texto seguro primeiro + `100_NATURAL_SEM_CONTRA_INDICACAO`

Texto obrigatorio para saude sensivel:

- orientar consulta com profissional de confianca;
- nao prometer cura;
- nao dizer "sem contraindicacao para todos".
- nao substituir medicamento;
- nao recomendar parar/remover medicacao;
- nao enviar audio de saude sozinho antes do texto seguro.

Resposta segura base:

> Le entiendo, señor. Si tiene diabetes, presion alta, problema del corazon, higado o riñon, si fue operado o si usa medicamentos, lo correcto es confirmar primero con su medico o farmaceutico de confianza antes de usar cualquier suplemento. No le voy a decir "si, tomelo" sin esa confirmacion. Si su profesional lo autoriza, con gusto seguimos con la informacion del pedido.

Prioridade:

- se a mesma mensagem tiver uso + saude, a saude responde primeiro;
- depois o funil retoma a etapa anterior;
- nao reinicia funil;
- nao apaga historico.

Teste 8637:

- mandar 5 frases curtas com grafias diferentes;
- verificar que responde e nao muda etapa principal.

### Fase 2 - Quantidades Fora do Padrao

Objetivo: cliente pede 2 ou 4, bot nao perde venda e nao contamina a oferta principal.

Regra aprovada em 22/05/2026:

- oferta principal/informativo continua somente 1, 3 e 6 frascos;
- 2 frascos nao aparecem como pacote principal;
- se o cliente pedir explicitamente 2 frascos, liberar excecao: 2 frascos por 70 USD;
- depois de informar 2 por 70, pedir confirmacao e seguir o funil normal de dados/logistica;
- 4 frascos e outras quantidades continuam sem pacote ativo.
- esta regra substitui a versao antiga "2 e 4 sempre voltam para 1, 3 ou 6"; agora somente 4 e outras quantidades voltam para 1, 3 ou 6.

Grafias esperadas:

- "2 frascos"
- "dos frascos"
- "2 botellas"
- "dos botellones"
- "quiero dos"
- "deme 2"
- "4 frascos"
- "cuatro frascos"
- "4 botellas"
- "quiero cuatro"
- "cuanto por 2"
- "cuanto me deja por 4"
- "me rebaja"
- "descuento por 2"

Resposta recomendada para cliente que pede 2:

> Perfecto, señor. Normalmente trabajamos con 1, 3 o 6 frascos, pero si usted desea 2, le puedo enviar 2 frascos por 70 USD. ¿Está de acuerdo?

Resposta recomendada para 4 ou outra quantidade sem pacote:

> Le entiendo, señor. Paquete de 4 frascos no tenemos activo. La promoción oficial de hoy está para 1, 3 o 6 frascos. ¿Cuál desea reservar?

Audios:

- se ainda nao recebeu tabela: `TRATAMENTO_Y_PRECIOS_PROMOCAO`;
- se ja recebeu tabela: texto puro para nao repetir audio;
- se escolhe 3: `3_BOTELLAS_POR_95_E_99`;
- se escolhe 6: `6_BOTELLAS_POR_167_E_99`.
- se escolhe 2: texto puro, porque nao existe audio oficial de 2 frascos.

Nao fazer:

- nao colocar 2 frascos no informativo principal;
- nao criar preco para 4;
- nao avancar para fechamento ate o cliente confirmar valor/quantidade.

### Fase 3 - Funciona / Serve Para Mim / Prova

Objetivo: responder objecao sem baguncar etapa atual.

Grafias esperadas:

- "funciona?"
- "si funciona"
- "de verdad funciona?"
- "realmente funciona?"
- "funcione?"
- "esto sirve?"
- "sirve para mi?"
- "me sirve?"
- "eso sirve?"
- "servira para mi?"
- "es bueno?"
- "es buena?"
- "que tan bueno es?"
- "que tal es?"
- "q tal es?"
- "es efectivo?"
- "si vale?"
- "vale la pena?"
- "sera bueno?"
- "sera que me ayuda?"
- "me ayuda de verdad?"
- "da resultado?"
- "es real?"
- "tiene prueba?"
- "hay prueba?"
- "prueba real?"
- "testimonios"
- "manda testimonios"
- "casos reales"
- "a otros les funciona?"
- "le ha funcionado a otros?"
- "no se si comprar"
- "no estoy seguro"
- "para mi edad?"
- "para hombres mayores?"
- "para energia/confianza/intimidad/potencia?"

Audios:

- `FUNCIONA_VIT_POWER`
- `DEPOIMENTO_AUDIO_PRODUTO`
- `FUNCIONA_TRATAMENTO_COMPLETO_100_NATURAL`
- possivel apoio: `PRODUDO_LIQUIDO_X_CAPSULA_MELHOR`

Resposta recomendada:

> Si, le explico. Funciona como apoyo natural, pero el resultado depende de la constancia y del organismo de cada persona. Le envio una explicacion corta y seguimos con su pedido.

Teste:

- garantir cooldown anti-spam;
- nao repetir depoimento se ja foi enviado;
- voltar para a etapa anterior.
- nao acionar se o cliente estiver falando de agencia/endereco/domicilio, por exemplo "esa agencia no me sirve";
- usar `FUNCIONA_VIT_POWER` e `DEPOIMENTO_AUDIO_PRODUTO` em revezamento de prova, sem rajada de audios.

### Fase 4 - Contraindicacao / Saude Sensivel

Objetivo: separar "duvida comercial" de "risco medico".

Grafias esperadas:

- "tengo diabetes"
- "soy diabetico/diabetico"
- "tengo azucar"
- "tengo glucosa"
- "tengo presion alta"
- "tengo presion baja"
- "tengo tension alta"
- "soy hipertenso/hispertenso/hipertenso"
- "sufro del corazon"
- "soy cardiaco"
- "tuve infarto"
- "tomo medicamentos"
- "tengo medicacion"
- "tomo medicina"
- "tomo remedios"
- "tomo pastillas"
- "uso insulina"
- "tomo metformina"
- "tomo losartan"
- "tomo enalapril"
- "tomo aspirina"
- "uso anticoagulante"
- "estoy operado"
- "tuve cirugia"
- "me operaron"
- "tengo problema del rinon"
- "tengo problema renal"
- "tengo problema del higado"
- "soy alergico"
- "me hace dano?"
- "me puede hacer mal?"
- "tiene efectos secundarios?"
- "tiene contraindicaciones?"
- "es contraindicado?"

Audios possiveis:

- `RECOMENDACOES_PARA_CLIENTE_QUE_PASSOU_POR_CIRURGIA_PROPOSTA`
- usar `100_NATURAL_SEM_CONTRA_INDICACAO` com cuidado, somente se o texto de seguranca vier antes.

Resposta recomendada:

> Le entiendo, señor. Si tiene diabetes, presion alta, problema del corazon, higado o riñon, si fue operado o si usa medicamentos, lo correcto es confirmar primero con su medico o farmaceutico de confianza antes de usar cualquier suplemento. No le voy a decir "si, tomelo" sin esa confirmacion. Si su profesional lo autoriza, con gusto seguimos con la informacion del pedido.

Nao fazer:

- nao afirmar "pode tomar sem problema";
- nao dizer "cura";
- nao usar audio "sem contraindicacao" sozinho, sempre texto seguro antes;
- nao substituir medicamento;
- nao recomendar parar/remover medicacao;
- nao enviar audio nesta camada antes da seguranca.

### Fase 5 - Entradas Sem Resposta: Audio, Imagem, Link, LID

Objetivo: nenhuma entrada real ficar muda.

Casos:

- audio sem transcricao;
- imagem sem legenda;
- link enviado pelo cliente;
- mensagem via LID sem telefone normalizado;
- inbound registrado sem outbound.

Regra aprovada em 22/05/2026:

- se for audio sem transcricao, nao descartar; encaminhar para camada lateral;
- se for imagem sem legenda, nao deixar o motor encerrar em silencio;
- se for link puro, imagem ou LID sem conteudo util, responder sinal curto: "👍 Vi, senhor. Ya lo reviso por aqui.";
- se for TikTok/Instagram/Facebook ou link social organico sem contexto comercial, responder fora do plano de vendas com joinha curto, exemplo: "👍 Lo vi, gracias por compartirlo.";
- link social organico nao deve iniciar funil, nao deve puxar preco e nao deve ser tratado como dado de pedido;
- se for audio sem transcricao, responder: "👍 Recibi su audio, señor. Para ayudarle sin error, escribame en una frase si su duda es sobre precio, como tomar, agencia o pedido.";
- se for cliente novo ou cliente dormente ha muitos dias, consultar historico/Order/ContactState;
- alem de Order e ContactState, consultar mensagens recentes para identificar se o cliente ja quis comprar;
- se ja comprou ou ja quis comprar, nao reiniciar funil: apenas acusar recebimento e manter memoria;
- se nao comprou e nao ha intencao/pedido em aberto, enviar funil inicial oficial Vit Power;
- manter cooldown/dedupe normal do roteador;
- nao apagar historico.

Resposta fallback segura:

> Recibi su mensaje, señor. Para ayudarle sin error, me escribe en una frase si su duda es sobre precio, como tomar, agencia o pedido?

Se for comprovante de retirada, nao usar fallback; deixar rotina de bonus/prova tratar.

Teste:

- simular audio sem transcricao;
- simular imagem sem legenda;
- simular link;
- simular LID conhecido;
- simular cliente novo;
- simular cliente com compra anterior;
- simular cliente com intencao/pending checkout;
- conferir registro em Message e ContactState.

### Fase 5.1 - Revisao das 46 conversas em "bot aguardando resposta"

Objetivo: transformar a fila real de mensagens sem resposta em melhorias pontuais do funil, sem apagar historico e sem reiniciar clientes que ja estao em etapa ativa.

Criterio operacional:

- primeira conversa deve receber um sinal humano entre 10 segundos e 1 minuto e 59 segundos;
- alvo operacional do bot: micro-resposta inicial entre 10 e 45 segundos, antes de audio/prova/imagem;
- considerar atraso operacional quando a ultima mensagem do cliente estiver sem resposta do bot/humano ha mais de 2 minutos;
- usar 5 minutos como alerta tardio para preco, quantidade, agencia, confirmacao final, pedido, guia ou retirada;
- usar 10 minutos apenas para auditoria de abandono/fila antiga, nao como tempo aceitavel de espera;
- revisar no maximo 46 conversas por rodada, priorizando as mais antigas e as de alta severidade.

Execucao:

```sh
npm run review:unanswered -- --minutes=2 --hot-minutes=2 --limit=46
```

Saidas esperadas:

- `docs/REVISAO_BOT_AGUARDANDO_RESPOSTA_YYYY-MM-DD.md`;
- `docs/REVISAO_BOT_AGUARDANDO_RESPOSTA_YYYY-MM-DD.json`.

Para cada uma das 46 conversas, o relatorio deve trazer:

- telefone/chat;
- tempo sem resposta;
- etapa atual do funil;
- ultima mensagem do cliente;
- problema identificado;
- solucao operacional;
- resposta sugerida curta;
- contexto recente suficiente para o humano validar.

Classes iniciais de problema:

- `fora_do_funil_social_ou_spam`;
- `audio_sem_transcricao`;
- `midia_sem_legenda`;
- `link_sem_contexto`;
- `link_social_organico`;
- `entrada_vsl_sem_preco`;
- `pergunta_preco_promocao`;
- `quantidade_escolhida_sem_continuacao`;
- `intencao_agencia_logistica`;
- `dados_domicilio_ou_endereco`;
- `nome_ou_dado_cliente`;
- `confirmacao_sem_acao`;
- `pos_venda_ou_logistica`;
- `duvida_produto_geral`;
- `duvida_como_tomar`;
- `saudacao_ou_entrada_curta`;
- `intencao_nao_classificada`.

Regra de atualizacao:

- se uma classe aparecer repetida em 3 ou mais conversas, virar regra de funil;
- se for caso unico, manter como sugestao de atendimento humano;
- se houver risco de duplicar pedido, travar reabertura e responder como pos-venda/logistica;
- se o bot falhou por dedupe/sanitizacao/envio bloqueado, ajustar guard ou texto antes de liberar.

### Fase 6 - Pos-venda Como Tomar

Objetivo: cliente ja comprou/retirou e pergunta uso sem reabrir venda.

Grafias esperadas:

- "ya retire, como tomo?"
- "ya compre, como se toma?"
- "ya me llego, como lo tomo?"
- "ya lo tengo, como se usa?"
- "recibi el producto, como tomo?"
- "como debo tomar esto?"
- "cuantas veces al dia?"
- "despues de comer?"
- "antes de comer?"
- "en ayunas?"
- "cuando tomo?"
- "cada cuanto?"
- "por cuanto tiempo?"
- "cuando veo resultado?"

Audios:

- `COMO_SE_TOMA_VIT_POWER`
- apoio se faltar audio principal: `COMO_TOMAR_VIT_POWER_SEM_REFERENCIA_QUANTIDADE_LITRO`
- `TEMPO_RESULTADO_VIT_POWER`
- apoio para tempo: `TRATAMENTO_CONTINUA_NAO_EFEITO_IMEDIATO`

Resposta recomendada:

> Claro, señor. Le ayudo con el uso de su Vit Power. Le envio la orientacion y cualquier duda me escribe por aqui. No voy a abrir otro pedido ahora.

Regra:

- nao sair da trava de pos-fechamento;
- nao reiniciar funil;
- nao oferecer nova compra ate Dropi/entrega permitir recompra.
- manter `order_closed`;
- apagar `pendingCheckoutOrder` se existir, sem apagar historico;
- se perguntar tempo/resultado junto com uso, enviar tambem `TEMPO_RESULTADO_VIT_POWER`.

### Fase 6B - Recompra Apos Entrega Por Quantidade

Objetivo: apos entrega/retiro confirmado, chamar o cliente para recompra no tempo correto conforme quantidade comprada, sem reiniciar o funil principal.

Regra operacional:

- calcular a recompra a partir da entrega/retiro confirmado no Dropi/guia;
- se comprou 1 frasco, chamar com 25 dias;
- se comprou 2 frascos, chamar com 50 dias;
- se comprou 3 frascos ou mais, chamar com 70 dias ate nova autorizacao para outra regra;
- marcar `automation.refillReminderAt` para nao repetir;
- manter historico, dados e pos-venda preservados;
- enviar texto de recompra mencionando quantos frascos comprou;
- enviar obrigatoriamente o audio `TEMPO_RESULTADO_VIT_POWER`;
- enviar uma prova social ainda nao enviada ao cliente, quando houver proxima disponivel na memoria de `prova`;
- prometer o regalo especial somente apos o fechamento da recompra;
- se o cliente responder querendo recomprar, seguir pelo fluxo de recompra ja congelado: quantidade e confirmacao dos dados existentes.

Texto base:

> Hola, señor 😊 Vi que compro 1/2/3 frascos de Vit Power y ya le tenemos reservada una oferta especial para que pueda completar el tratamiento con tranquilidad. Le envio tambien una orientacion sobre el tiempo de resultado. Si desea continuar, le ayudo a separar su recompra por aqui. Al cerrar esta recompra, le voy a liberar un regalo especial para usted.

Audios:

- `TEMPO_RESULTADO_VIT_POWER`

### Fase 7 - Agencia Natural

Objetivo: entender "Palestina", "frente a la comision de transito", "ahi retiro" sem quebrar A/B/C.

Status: Fase 7A, 7B e 7C aplicadas como camadas laterais. Nao altera fechamento, resumo, confirmacao, preco, quantidade, pos-venda, recompra ou Dropi.

Principio:

- reconhecer primeiro a cidade;
- so depois sugerir agencias dentro daquela cidade;
- quando houver varias agencias na cidade, pedir escolha por A/B/C ou nome/setor;
- quando houver referencia sem cidade, como "frente a la comision de transito", pedir cidade antes de escolher;
- nao trocar agencia fechada sem confirmacao.

Fase 7B - Agencia dentro da cidade:

- com cidade reconhecida, usar nome, setor e endereco para ordenar agencias;
- referencia forte dentro da cidade pode confirmar uma agencia, exemplo `Duran + frente a la comision de transito`;
- palavras genericas como `centro`, `norte` ou `sur` nao confirmam sozinhas quando houver varias agencias;
- sem cidade, referencia solta nao deve apontar agencia.

Fase 7C - Escolha natural apos A/B/C:

- aceitar `A`, `B`, `C`, `1`, `2`, `3`, `opcion A`;
- aceitar `la primera`, `la segunda`, `la tercera`;
- aceitar nome/setor/endereco quando apontar uma unica opcao exibida;
- aceitar `esa`, `ahi retiro`, `me sirve` somente quando houver uma unica opcao disponivel;
- se a frase for ambigua com varias opcoes, pedir A/B/C novamente.

Grafias esperadas:

- "Palestina"
- "en la agencia de Palestina"
- "frente a la comision de transito"
- "ahi retiro"
- "esa me sirve"
- "la del centro"
- "la primera"
- "la segunda"
- "opcion A"
- "la A"
- "paletina", "palesina", "palestna" -> Palestina;
- "guayakil", "guayaqil", "gquil", "gye" -> Guayaquil;
- "qito", "kito", "quiyo" -> Quito;
- "machla", "mchala" -> Machala;
- "portoviego", "porto viejo" -> Portoviejo;
- "rio bamba" -> Riobamba;
- "sto domingo", "santo domigo" -> Santo Domingo.

Regra:

- se houver etapa `awaiting_agency_selection`, aceitar letra, numero ordinal ou referencia textual;
- se nao houver etapa de agencia ativa, pedir cidade/provincia primeiro;
- nao trocar agencia fechada sem confirmacao.

## Ordem Recomendada Agora

1. Fase 2 - Quantidades fora do padrao.
2. Fase 3 - Funciona / serve para mim / prova, incluindo `DESCONFIADO`, `CLIENTE_PARA_QUE_SERVE` e `CLIENTE_SEXUALMENTE_FRUSTRADO`.
3. Fase 4 - Saude sensivel refinada, perfil `SAUDE_CUIDADOSO`.
4. Fase 5 - Entradas sem resposta.
5. Fase 6 - Pos-venda como tomar, perfil `POS_VENDA`.
6. Fase 7 - Agencia natural, perfil `LOGISTICO`.
7. Fase 0 operacional - so depois: gravar `profile_type` e `buyer_score` no painel/memoria.

Motivo: a Fase 1 ja foi aplicada; quantidade 2/4 e a proxima maior perda comercial sem tocar bloco congelado de fechamento/agencia. O motor de perfil deve nascer como comportamento validado, nao como refatoracao grande.

## Checklist Padrao de Cada Fase

Antes:

- congelar estado atual;
- listar arquivos que podem mudar;
- definir frases de teste.

Durante:

- alterar somente uma regra;
- nao refatorar modulos grandes;
- nao mexer em Dropi/agencia/fechamento se a fase nao pedir.

Depois:

- `node --check`;
- `npm run senior:check`;
- teste no 8637;
- verificar logs;
- congelar resultado;
- anotar rollback.
