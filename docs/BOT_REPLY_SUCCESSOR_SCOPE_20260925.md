# Bot replies successor — scope fixed before runtime edits

Parent R4 commit: `fe32da042617335d11b9fcde2e5dc0d4519c9915`
Parent R4 tree: `fe3c34e7a47d3e291c1d4c349e493ebbc93c9b6c`
Active release: `/opt/vitalismen-automacao/releases/20260925T195542Z_production-20260925-fe32da0`

The parent `senior:check` and `senior-guard.mjs` passed in the active R4 release with `unified-successor-v202-r4-preload.mjs`. This document is a change boundary, not deployment approval. The Protocolo G VSL ingress freeze remains unchanged.

## Reply file inventory at parent R4

`R4` means the file appears in `docs/freeze/unified-successor-v202-r4-v78-controller-pin-20260925.json`. Older versioned freezes can protect files even where the R4 allowlist does not.

| Path | Role | SHA-256 at parent | Protected by | Ingress-related |
| --- | --- | --- | --- | --- |
| `src/services/agentRouter.js` | inbound dispatch, product selection, manual takeover, first-response coordination | `4b5572d44bf360aa3e503caf226d286b1117e9f6f3a9c6bb24d7aacb65d76709` | R4, V171 | yes |
| `src/services/conversationEngine.js` | general intent, replies, order and post-sale continuity | `0fe93987f5bb7e9735355fcf896b2c86abf97b0efa03af8828eb9dcb249bbfd3` | R4, V168b | yes |
| `src/services/texUltraFunnelService.js` | Tex Ultra response selection and customer-data prompts; also VSL payload parsing | `4923e689dee1bca509cc2745b7efa4907d118edc23ca57ac423bc029f451d5b3` | R4, V198, V27 | yes — only the post-ingress `awaiting_name` reply hunk may change |
| `src/services/texUltraInitialLayerService.js` | greeting, initial cadence, interrupt/resume | `2f869c5dab7befe84a5ac4f53eb2232f60d0af681e1619e06134fced9c5038aa` | V25, initial-layer freezes | yes |
| `src/services/texUltraEntryGreetingService.js` | approved first-reply salutation | `b78e0dabd809e27917271e0a9343c6b3a6ea30a5174c3115278d42eeacea20e8` | V12 and prior Tex Ultra freezes | yes |
| `src/services/texUltraHowToUseAudioService.js` | usage reply, sent-audio lookup and dedupe | `fb2fceac4fe5360dc2725d2103e479e980b97a95134076fcf93024904fe53374` | V31 | no |
| `src/services/texUltraProductProfile.js` | Tex Ultra product text, offer and usage audio identity | `53a15a623a726cce8a38a7e0ef315cc5ada61534325f348d318ae3e50016a807` | Tex Ultra product freezes | no |
| `src/services/outboundDedupeService.js` | first response and later outbound dedupe | `8101f81d92743ae407d305f179b427daaf55cd8348c9507c39a415a9606a3752` | R4, V198 | yes |
| `src/services/vslFirstResponseWatchdogV193Service.js` | historical first-response watchdog | `471a73124379828f4a6bd0cf0b2ce902d6786663c3b97ae01da8bc20ae0db0e7` | V193, later successors | yes |
| `src/services/agentProfiles.js` | product-agent definitions and manual product context | `e3c5d69d18adb5920c41a2b5ca44c356d278fec7e742db7810161d96138c2391` | multiproduct freezes | no |
| `src/services/ecConversationBucketService.js` | engagement versus commercial/support intent | `d3d970cce0de4aa37862a35395f25aba1f5eff839eb9253bcc90a19e5e4c3e36` | R4, V40 | no |
| `src/services/ecEngagementReplyService.js` | non-commercial engagement templates and reply lock | `1757e2d41230f314cb0da3436bc0715ee53041c5767245eade937bc7ed0c3ea7` | V40–V43 | no |
| `src/services/texUltraConfirmedPostSaleLayerService.js` | Tex Ultra post-order audio responses | `7d28eca9f32b3b8dbdcf3f108350a27ed168696f52d0bebaa26f933247979584` | post-sale freezes | no |
| `src/services/postSaleTemplateCatalogV147Service.js` | product-specific post-sale template catalog | `af8675ef85f6a17a7675335fc39465048fc714d1b326c6294be27f73b7838ade` | V147 | no |
| `src/services/postSaleProductResolutionV147R5Service.js` | resolves product of post-sale events | `a3aab5f6dbcde7e7ca495dd951cc14192cbd4b008e70a1180250b0a93b251b2f` | V147 R5 | no |
| `src/services/postSaleNotificationDecisionService.js` | post-sale send eligibility | `e2bdb618fb5bf097b7175cfa64044d07261c77de5ddbcdb9f90f75da498c5c9d` | R4 | no |
| `src/services/postSaleFullOperationalV188Service.js` | post-sale operation selection | `524ba591f91ea90feeb6722facba0565f728676fd0e48c4a1b8958b8ed8606fc` | V188 | no |
| `src/services/postSaleFullExecutorV188Service.js` | post-sale dispatch | `dec0dfd7806125094a7867489cab03b21c5408f2449749931bdc1442f7c92d2e` | V188 | no |
| `src/services/audioTemplateService.js` | media template resolution | `8d60e7d08dd03a1ba85aad598105d57a7fb9d35cb8413730f941789929e0418c` | media freezes | no |
| `src/whatsapp/sendText.js` | outbound text transport and anti-spam | `fa9dd0616935037358388097e3aa1b726777e1851551647a02a4bce2899a0cd3` | R4 | no |
| `src/whatsapp/sendAudio.js` | outbound audio transport and anti-spam | `52f9d1b1bf324b4b0826a50d4256fc6e637d6ac83c67348dcead2f86807ad7ac` | R4 | no |

## Frozen change allowlist — established before the first runtime edit

- `BOT_REPLY_RUNTIME`: `src/services/texUltraFunnelService.js`, limited to the existing `awaiting_name` reply transition after the customer supplies a verified name. VSL parsing, routing, attribution, first reply, product assignment, send transport and order side effects are excluded.
- `BOT_REPLY_TESTS`: `tests/tex-ultra-reply-continuity-successor.test.mjs` and `tests/bot-replies-successor-governance.test.mjs` only.
- `BOT_REPLY_SUCCESSOR_GOVERNANCE`: this document, `scripts/lib/bot-replies-successor-context.mjs`, `scripts/guard-bot-replies-successor.mjs` only. The post-commit root-owned authority and ready-for-review checkpoints are outside Git and cannot be written before the exact successor commit/tree exist.

Any other changed path blocks the candidate. No existing guard, freeze manifest, VSL, Z-API ingress, panel persistence, Meta, Dropi, checkout or PM2 file may change.
