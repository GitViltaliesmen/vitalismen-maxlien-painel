# Preparação controlada do provider WhatsApp EC — 2026-09-17

Escopo exclusivo: painel `https://ec.maxlien.shop/qr.html?v=20260610194152`, VSL `https://vilaliemen.shop/protocolo-g` e infraestrutura WhatsApp da operação EC.

## Baseline imutável

- Commit: `273ba40dc2be285ee916b94ea9685b544b79ed63`
- Tree: `45cd3fe22e6ea4b36acee617b2c21e62a082b46c`
- Release: `20260917T023905Z_production-20260917-273ba40`
- Tag: `production-20260917-273ba40`
- Rollback: `20260916T122026Z_production-20260916-533b78f`
- Produção confirmada: health HTTP 200, processo principal online e Z-API conectada.
- `guard:freeze-lock`: PASS local e na release ativa.

Os 18 arquivos comerciais protegidos pelo manifesto V170 conservam seus hashes. Qualquer arquivo rastreado fora dos quatro artefatos provider-only desta preparação é recusado pelo audit. Alteração fora desse limite exige `AUTHORIZATION_ID` explícito e, mesmo com identificador, continua proibida nesta missão de infraestrutura.

## Integridade pública inicial

| Superfície | Resultado | SHA-256 |
| --- | --- | --- |
| Painel oficial | HTTP 200 | `0d688fa9bcf0d46466f01c79188614ac6874ea6a0e2fe32aed5a136583fe56ee` |
| Protocolo-G mobile | HTTP 200, VSL/VTurb | `918d9a29113fe2ce807cf453c5a1e3b191c8d870103a93670842a7d4f0b80a13` |
| Protocolo-G desktop | HTTP 200, página informativa | `ddf1a65ff3696a10ce7105523397592a85566cb837447210eecb100d3953cf27` |

O HTML mobile mantém os assets versionados de tracking e as duas origens VTurb. O HTML desktop mantém o bundle informativo próprio. Nenhuma dessas superfícies foi editada.

## Matriz de dependência atual

| Capacidade | Dependência física atual | Substituto existente | Estado Web |
| --- | --- | --- | --- |
| Inbound | webhook e normalização Z-API | normalizador + orquestrador canônico | contrato somente |
| Outbound | roteador e clientes de texto/mídia Z-API | coordenador + adapter Web | contrato somente |
| Texto | cliente Z-API | `WhatsAppWebTransport.sendText` | fixture somente |
| Áudio | cliente Z-API | `WhatsAppWebTransport.sendAudio` | fixture somente |
| Imagem | cliente Z-API | `WhatsAppWebTransport.sendMedia` | fixture somente |
| Message ID | mirror/callback Z-API | ledger canônico | contrato somente |
| Delivery ACK | callback Z-API | evento de receipt Baileys | não implementado ao vivo |
| Read ACK | callback Z-API | evento de receipt Baileys | não implementado ao vivo |
| Health | GET Z-API | health do adapter Web | fixture somente |
| Identidade de sessão | configuração Z-API | registry + session manager | contrato somente |
| Status no painel | endpoints Z-API | projeção do control plane | não ligado a socket real |
| Roteamento do bot | rota inbound Z-API | orquestrador provider-independent | contrato somente |

O diretório `src/whatsapp/core` tem zero import direto do cliente Z-API. O acoplamento remanescente está nas bordas legadas de runtime e não foi removido porque elas sustentam o provider oficial e o rollback.

## Sessões e bloqueadores

- Uma identidade Web está configurada no ambiente.
- Não existe credencial persistida dessa identidade no caminho consumido pelo runtime.
- Existe um diretório de autenticação para uma identidade pausada; ele não deve ser movido, copiado, ativado ou usado para inferir pareamento.
- Não existem segunda e terceira identidades Web configuradas.
- O runtime ativo está em `STRICT_READ_ONLY`; Baileys não inicia e não captura clientes.
- Gerar novo QR, trocar identidade ou ativar socket real permanece sem autorização.
- Delivery ACK, read ACK e webhook/socket ingress ainda não existem no adapter Web ao vivo.

Consequência: `WHATSAPP_WEB_MODE=SHADOW`, primeira sessão `FAIL` para prontidão real e demais sessões `NOT_CONFIGURED`. Nenhum teste real de texto, áudio, imagem, inbound, outbound ou ACK foi executado.

## Testes sem rede

- Suíte comercial congelada com contexto sucessor oficial: 137/137.
- V152 provider/afinidade/ledger/painel: 20/20.
- V152 control plane/swap: 6/6.
- Guard de fronteira desta preparação: 5/5.
- Restart shadow: 1/1, com dois reinícios simulados, zero pareamento real e zero chamadas de rede.
- Total provider único: 32/32.

## Futuro cutover

O manifesto em `docs/provider/ec-whatsapp-provider-cutover-manifest-20260917.json` registra checklist, sequência de cutover, rollback, desativação futura, remoção futura de secrets/webhook e testes posteriores. Ele é somente planejamento; não altera runtime, provider, sessão, painel ou VSL.

## Estado seguro

Produção permanece na release V170, Z-API permanece como provider oficial, WhatsApp Web permanece shadow, nenhuma mensagem foi enviada, nenhum QR foi gerado e nenhum segredo ou webhook foi alterado.
