"""Build only from the inspected official preimages; no production access."""
import base64
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
STAGE = ROOT / 'ops/candidates/tex-cta-qa-panel-v248-20261118'
OFFICIAL = STAGE / 'official'
OUT = STAGE / 'built'
OUT.mkdir(exist_ok=True)
sha = lambda b: hashlib.sha256(b).hexdigest()
addon = b'\n' + (HERE / 'cta-label.js').read_bytes()
native = (OFFICIAL / 'whatsapp-tex-v243.js').read_bytes()
assert sha(native) == 'de67f978c52f7676d666bb22f2175cf72baa283f13fa47f7424d3a5262c35fcd'
cta = native + addon
(OUT / 'whatsapp-tex-v243.js').write_bytes(cta)
panel = (OFFICIAL / 'qr.html').read_bytes()
helper = (HERE / 'qa-panel.js').read_bytes().decode()
patches = []

def patch(before, after):
    global panel
    before, after = before.encode(), after.encode()
    assert panel.count(before) == 1, ('PATCH_NOT_EXACT', before[:90])
    panel = panel.replace(before, after, 1)
    patches.append({'beforeBase64': base64.b64encode(before).decode(), 'afterBase64': base64.b64encode(after).decode()})

patch('        const setAttendancePulse = (chat) => {',
      '        // BEGIN QA_PANEL_TRUTH_V248\n' + helper + '\n'
      '        const qaPanelUiV248 = createQaPanelUiV248({ api, getChat: () => state.selectedChat,\n'
      '            getScope: () => String(state.selectedChatEpoch) + "|" + currentContactStateKey(),\n'
      '            refresh: () => { setAttendancePulse(state.selectedChat); renderMessages(state.currentMessages, { preserveScroll: true }); } });\n'
      '        // END QA_PANEL_TRUTH_V248\n'
      '        const setAttendancePulse = (chat) => {')
patch("el('commandStatusBtn').textContent = globalOff ? automationOffLabel() : (manual ? 'HUMANO NO COMANDO' : 'BOT ONLINE');",
      "el('commandStatusBtn').textContent = globalOff ? automationOffLabel() : (manual ? 'HUMANO NO COMANDO' : (qaPanelUiV248.status(chat)?.badge || 'BOT ONLINE'));")
patch("}).join('') || '<div class=\"empty\">Sem mensagens salvas para este cliente.</div>';",
      "}).join('') || qaPanelUiV248.emptyHtml(state.selectedChat);")
patch('                const messages = mergePendingLocalMessages(data || []);',
      '                qaPanelUiV248.load().catch(() => null);\n'
      '                const messages = mergePendingLocalMessages(data || []);')
(OUT / 'qr.html').write_bytes(panel)
manifest = {
    'project': 'VITALISMEN_EC', 'version': 248,
    'authorization': 'USER_20261118_SIMPLIFY_WHATSAPP_CTA_FIX_QA_EMPTY_STATUS_TEST_PUBLISH_FREEZE',
    'status': 'AUTHORIZED_EXACT_SUCCESSOR',
    'parentSourceCommit': '72c6ab9c0e66e52bb79540ad2cbe7e18af8b6c96',
    'parentWhatsappFreezeSha256': sha((ROOT / 'docs/freeze/plusmen-tex-whatsapp-clean-v245-20261117.json').read_bytes()),
    'backendReleaseUnchanged': '/opt/vitalismen-automacao/releases/20261118T170557Z_production-20261118-1b356e3',
    'cta': {'path': '/var/www/plusmen-tex-vsl-v1/assets/whatsapp-tex-v243.js',
            'beforeSha256': sha(native), 'sha256': sha(cta), 'addonSha256': sha(addon),
            'addonBase64': base64.b64encode(addon).decode(), 'label': 'PEDIR TEX ULTRA POR WHATSAPP',
            'phone': '553171862958', 'message': 'Hola, quiero el tratamiento Tex Ultra.'},
    'panel': {'path': '/var/www/vitalismen-panel-phonefix-20261108-r1/qr.html',
              'beforeSha256': sha((OFFICIAL / 'qr.html').read_bytes()), 'sha256': sha(panel),
              'helperSha256': sha((HERE / 'qa-panel.js').read_bytes()), 'patches': patches,
              'patchesSha256': sha(json.dumps(patches, separators=(',', ':')).encode())},
    'preserved': ['player', 'cta2257s', 'turbo1.2', 'nativeClickHandler', 'phone', 'directMessage',
                  'desktopInformative', 'chatCtaGate', 'meta', 'backend', 'qaPermits', 'allCustomerData',
                  'allHistoryAndDedupe', 'leftListNoMessagePreviews'],
}
(STAGE / 'manifest.json').write_bytes((json.dumps(manifest, indent=2) + '\n').encode('utf8'))
(ROOT / 'docs/freeze/tex-cta-qa-panel-v248-20261118.json').write_bytes((json.dumps(manifest, indent=2) + '\n').encode('utf8'))
print(json.dumps({k: {a: v for a, v in manifest[k].items() if a.endswith('Sha256') or a in ['path', 'sha256']} for k in ['cta', 'panel']}, indent=2))
