#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

readonly INSTALLER_ID="vitalismen-activation-permit-v5-20260818"
readonly HELPER="/usr/local/sbin/vitalismen-stage"
readonly SUDOERS_FILE="/etc/sudoers.d/vitalismen-codex-stage"
readonly STATE_DIR="/var/lib/vitalismen-deploy"
readonly PERMIT_FILE="${STATE_DIR}/activate-permit.json"
readonly EXPECTED_HELPER_SHA256="00b0aeae2e748e4e638082939acc3c86b4fd84fa4cb799ae477a3531004312c3"
readonly TAG="production-20260817-46a81f5"
readonly COMMIT="46a81f5fe5f0dc89cc41353ae5eacefce08e82a5"
readonly RELEASE="20260817T235735Z_production-20260817-46a81f5"
readonly ROLLBACK="20260817T185539Z_production-20260817-3b6adfb"
readonly CURRENT_EXPECTED="20260817T185539Z_production-20260817-3b6adfb"
readonly RELEASES_DIR="/opt/vitalismen-automacao/releases"
readonly CURRENT_LINK="/opt/vitalismen-automacao/current"
readonly LOCK_FILE="/run/lock/vitalismen-permit-install-v5.lock"

die() {
  echo "ERRO: $*" >&2
  exit 1
}

[[ "${EUID}" -eq 0 ]] || die "execute este script como root"
[[ "$CURRENT_EXPECTED" == "$ROLLBACK" ]] || die "CURRENT_ESPERADO diverge do rollback"

exec 8>"$LOCK_FILE"
flock -n 8 || die "outra instalação de autorização está em execução"

readonly RUN_ID="$(date -u +%Y%m%dT%H%M%SZ).$$"
readonly BACKUP_DIR="/var/backups/vitalismen-activation-permit-v5/${RUN_ID}"
readonly HELPER_CANDIDATE="$(mktemp /root/vitalismen-stage.v5.XXXXXX)"
readonly SUDOERS_CANDIDATE="$(mktemp /etc/sudoers.d/.vitalismen-codex-stage.XXXXXX)"
readonly PERMIT_CANDIDATE="${STATE_DIR}/.activate-permit.json.${RUN_ID}"

install -d -o root -g root -m 0700 "$BACKUP_DIR" "$STATE_DIR"

had_sudoers=0
had_permit=0
snapshot_complete=0
installation_complete=0

cleanup_and_restore() {
  local exit_code=$?
  trap - EXIT
  set +e

  rm -f -- "$HELPER_CANDIDATE" "$SUDOERS_CANDIDATE" "$PERMIT_CANDIDATE"

  if [[ "$installation_complete" != "1" && "$snapshot_complete" == "1" ]]; then
    if [[ -f "$BACKUP_DIR/vitalismen-stage" ]]; then
      install -o root -g root -m 0755 "$BACKUP_DIR/vitalismen-stage" "$HELPER"
    fi

    if [[ "$had_sudoers" == "1" && -f "$BACKUP_DIR/vitalismen-codex-stage" ]]; then
      install -o root -g root -m 0440 "$BACKUP_DIR/vitalismen-codex-stage" "$SUDOERS_FILE"
    else
      rm -f -- "$SUDOERS_FILE"
    fi

    if [[ "$had_permit" == "1" && -f "$BACKUP_DIR/activate-permit.json" ]]; then
      install -o root -g root -m 0600 "$BACKUP_DIR/activate-permit.json" "$PERMIT_FILE"
    else
      rm -f -- "$PERMIT_FILE"
    fi

    visudo -cf /etc/sudoers >/dev/null 2>&1 || true
    echo "INSTALACAO_REVERTIDA=SIM" >&2
  fi

  exit "$exit_code"
}
trap cleanup_and_restore EXIT

[[ -f "$HELPER" && ! -L "$HELPER" ]] || die "helper oficial ausente ou inválido"
[[ "$(stat -c '%U:%G:%a' "$HELPER")" == "root:root:755" ]] || die "permissões atuais do helper inválidas"
[[ "$(sha256sum "$HELPER" | awk '{print $1}')" == "$EXPECTED_HELPER_SHA256" ]] ||
  die "helper mudou desde a auditoria; atualização recusada"

[[ "$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)" == "$RELEASES_DIR/$CURRENT_EXPECTED" ]] ||
  die "current diverge do baseline autorizado"
[[ -d "$RELEASES_DIR/$RELEASE" && ! -L "$RELEASES_DIR/$RELEASE" ]] ||
  die "release candidata ausente ou inválida"
[[ -d "$RELEASES_DIR/$ROLLBACK" && ! -L "$RELEASES_DIR/$ROLLBACK" ]] ||
  die "release de rollback ausente ou inválida"

install -o root -g root -m 0755 "$HELPER" "$BACKUP_DIR/vitalismen-stage"
install -o root -g root -m 0755 "$HELPER" "$HELPER_CANDIDATE"

if [[ -e "$SUDOERS_FILE" ]]; then
  [[ -f "$SUDOERS_FILE" && ! -L "$SUDOERS_FILE" ]] || die "sudoers atual não é arquivo regular"
  had_sudoers=1
  install -o root -g root -m 0440 "$SUDOERS_FILE" "$BACKUP_DIR/vitalismen-codex-stage"
fi

if [[ -e "$PERMIT_FILE" ]]; then
  [[ -f "$PERMIT_FILE" && ! -L "$PERMIT_FILE" ]] || die "permit atual não é arquivo regular"
  [[ "$(stat -c '%U:%G:%a' "$PERMIT_FILE")" == "root:root:600" ]] ||
    die "permit atual possui permissões inseguras"
  had_permit=1
  install -o root -g root -m 0600 "$PERMIT_FILE" "$BACKUP_DIR/activate-permit.json"
fi

snapshot_complete=1

python3 - "$HELPER_CANDIDATE" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")


def replace_once(old: str, new: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(
            f"ERRO: trecho esperado ocorreu {count} vezes; atualização recusada."
        )
    text = text.replace(old, new, 1)


replace_once(
    '''state_dir="/var/lib/vitalismen-deploy"
protected_log_dir="/var/log/vitalismen-deploy"
process_name="vitalismen-automation"
official_health_url="https://ec.maxlien.shop/api/health/"
official_panel_url="https://ec.maxlien.shop/n/"
local_health_url="http://127.0.0.1:3001/api/health/"
sudoers_file="/etc/sudoers.d/vitalismen-codex-stage"

allowed_activate_tag="production-20260817-3b6adfb"
allowed_activate_release="20260817T185539Z_production-20260817-3b6adfb"
allowed_previous_release="20260817T022344Z_production-20260816-e0e2c54"
allowed_activate_command="/usr/local/sbin/vitalismen-stage activate ${allowed_activate_tag} ${allowed_activate_release} ${allowed_previous_release}"''',
    '''state_dir="/var/lib/vitalismen-deploy"
permit_file="$state_dir/activate-permit.json"
protected_log_dir="/var/log/vitalismen-deploy"
process_name="vitalismen-automation"
official_health_url="https://ec.maxlien.shop/api/health/"
official_panel_url="https://ec.maxlien.shop/n/"
local_health_url="http://127.0.0.1:3001/api/health/"
sudoers_file="/etc/sudoers.d/vitalismen-codex-stage"
allowed_activate_command="/usr/local/sbin/vitalismen-stage activate"'''
)

safe_label_marker = '''safe_label() {
  printf '%s' "$1" | tr -c 'A-Za-z0-9_-' '_'
}
'''

load_permit_function = r'''
load_activation_permit() {
  local permit_payload
  local current_target
  local release_dir
  local rollback_dir

  [[ -f "$permit_file" && ! -L "$permit_file" ]] || return 1
  [[ "$(stat -c '%U:%G:%a' "$permit_file" 2>/dev/null || true)" == "root:root:600" ]] || return 1

  current_target="$(readlink -f "$base_dir/current" 2>/dev/null || true)"
  [[ -n "$current_target" ]] || return 1

  permit_payload="$(
    /usr/bin/node - "$permit_file" "$releases_dir" "$current_target" <<'NODE'
const fs = require('node:fs');

const [permitPath, releasesDir, currentTarget] = process.argv.slice(2);
const permit = JSON.parse(fs.readFileSync(permitPath, 'utf8'));
const expectedKeys = [
  'commit',
  'createdAt',
  'currentExpected',
  'expiresAt',
  'release',
  'rollback',
  'singleUse',
  'status',
  'tag',
  'version'
];
const actualKeys = Object.keys(permit).sort();

if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
  throw new Error('campos da autorização inválidos');
}
if (permit.version !== 1) throw new Error('versão inválida');
if (permit.status !== 'authorized') throw new Error('status inválido');
if (permit.singleUse !== true) throw new Error('autorização não é de uso único');

const tagPattern = /^production-([0-9]{8})-([0-9a-f]{7})$/;
const releasePattern = /^([0-9]{8})T([0-9]{6})Z_(production-([0-9]{8})-([0-9a-f]{7}))$/;
const tagMatch = String(permit.tag || '').match(tagPattern);
const releaseMatch = String(permit.release || '').match(releasePattern);
const rollbackMatch = String(permit.rollback || '').match(releasePattern);
const currentMatch = String(permit.currentExpected || '').match(releasePattern);
const commit = String(permit.commit || '');

if (!tagMatch) throw new Error('tag inválida');
if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error('commit inválido');
if (!releaseMatch) throw new Error('release inválida');
if (!rollbackMatch) throw new Error('rollback inválido');
if (!currentMatch) throw new Error('current esperado inválido');
if (releaseMatch[1] !== tagMatch[1]) throw new Error('data da release diverge da tag');
if (releaseMatch[3] !== permit.tag) throw new Error('nome da release diverge da tag');
if (commit.slice(0, 7) !== tagMatch[2]) throw new Error('commit diverge da tag');
if (permit.currentExpected !== permit.rollback) throw new Error('current esperado diverge do rollback');
if (permit.release === permit.rollback) throw new Error('release candidata igual ao rollback');

const createdAt = Date.parse(permit.createdAt);
const expiresAt = Date.parse(permit.expiresAt);
const now = Date.now();
if (!Number.isFinite(createdAt) || !Number.isFinite(expiresAt)) throw new Error('datas inválidas');
if (createdAt > now + 60_000) throw new Error('autorização criada no futuro');
if (expiresAt <= now) throw new Error('autorização expirada');
if (expiresAt <= createdAt || expiresAt - createdAt > 3_600_000) {
  throw new Error('janela de autorização inválida');
}

const releaseDir = `${releasesDir}/${permit.release}`;
const expectedCurrentTarget = `${releasesDir}/${permit.currentExpected}`;
if (currentTarget !== expectedCurrentTarget) throw new Error('current real divergente');

const source = JSON.parse(fs.readFileSync(`${releaseDir}/.release-source.json`, 'utf8'));
const staging = JSON.parse(fs.readFileSync(`${releaseDir}/.staging-complete.json`, 'utf8'));
if (source.repository !== 'GitViltaliesmen/vitalismen-maxlien-painel') throw new Error('repositório divergente');
if (source.branch !== 'production') throw new Error('branch divergente');
if (source.tag !== permit.tag) throw new Error('tag da release divergente');
if (source.releaseName !== permit.release) throw new Error('nome da release divergente');
if (String(source.commit || '').toLowerCase() !== commit) throw new Error('commit da release divergente');
if (staging.status !== 'complete') throw new Error('staging incompleto');
if (staging.tag !== permit.tag) throw new Error('tag do staging divergente');
if (String(staging.commit || '').toLowerCase() !== commit) throw new Error('commit do staging divergente');
if (staging.currentUnchanged !== true || staging.pm2Unchanged !== true) {
  throw new Error('garantias do staging ausentes');
}

process.stdout.write([
  permit.tag,
  commit,
  permit.release,
  permit.rollback,
  permit.currentExpected
].join('\t') + '\n');
NODE
  )" || return 1

  IFS=$'\t' read -r \
    permit_tag \
    permit_commit \
    permit_release \
    permit_rollback \
    permit_current_expected <<<"$permit_payload"

  [[ "$permit_tag" =~ ^production-[0-9]{8}-[0-9a-f]{7}$ ]] || return 1
  [[ "$permit_commit" =~ ^[0-9a-f]{40}$ ]] || return 1
  [[ "$permit_release" =~ ^[0-9]{8}T[0-9]{6}Z_production-[0-9]{8}-[0-9a-f]{7}$ ]] || return 1
  [[ "$permit_rollback" =~ ^[0-9]{8}T[0-9]{6}Z_production-[0-9]{8}-[0-9a-f]{7}$ ]] || return 1
  [[ "$permit_current_expected" == "$permit_rollback" ]] || return 1

  release_dir="$releases_dir/$permit_release"
  rollback_dir="$releases_dir/$permit_rollback"
  [[ -d "$release_dir" && ! -L "$release_dir" ]] || return 1
  [[ -d "$rollback_dir" && ! -L "$rollback_dir" ]] || return 1
  [[ "$(stat -c '%U:%G:%a' "$release_dir" 2>/dev/null || true)" == "root:root:700" ]] || return 1
  [[ "$(stat -c '%U:%G:%a' "$rollback_dir" 2>/dev/null || true)" == "root:root:700" ]] || return 1
  [[ "$(stat -c '%U:%G:%a' "$release_dir/.release-source.json" 2>/dev/null || true)" == "root:root:600" ]] || return 1
  [[ "$(stat -c '%U:%G:%a' "$release_dir/.staging-complete.json" 2>/dev/null || true)" == "root:root:600" ]] || return 1
}
'''

if text.count(safe_label_marker) != 1:
    raise SystemExit("ERRO: ponto de inserção do permit não encontrado.")
text = text.replace(safe_label_marker, safe_label_marker + load_permit_function, 1)

validate_start = text.find("validate_release_markers() {")
validate_end_marker = '\n\naction="${1:-}"'
validate_end = text.find(validate_end_marker, validate_start)
if validate_start < 0 or validate_end < 0:
    raise SystemExit("ERRO: validate_release_markers não encontrado.")

new_validate_release_markers = r'''validate_release_markers() {
  local release_dir="$1"
  local expected_tag="$2"
  local expected_commit="$3"
  local expected_release="$4"

  /usr/bin/node - \
    "$release_dir/.release-source.json" \
    "$release_dir/.staging-complete.json" \
    "$expected_tag" \
    "$expected_commit" \
    "$expected_release" <<'NODE'
const fs = require('node:fs');
const [sourcePath, stagingPath, expectedTag, expectedCommit, expectedRelease] = process.argv.slice(2);
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const staging = JSON.parse(fs.readFileSync(stagingPath, 'utf8'));
const commit = String(source.commit || '').toLowerCase();

if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error('commit inválido');
if (commit !== expectedCommit) throw new Error('commit não autorizado');
if (source.repository !== 'GitViltaliesmen/vitalismen-maxlien-painel') throw new Error('repositório inválido');
if (source.branch !== 'production') throw new Error('branch inválida');
if (source.tag !== expectedTag) throw new Error('tag inválida');
if (source.releaseName !== expectedRelease) throw new Error('release inválida');
if (staging.status !== 'complete') throw new Error('staging incompleto');
if (String(staging.commit || '').toLowerCase() !== commit) throw new Error('commit do staging divergente');
if (staging.tag !== expectedTag) throw new Error('tag do staging divergente');
if (staging.currentUnchanged !== true || staging.pm2Unchanged !== true) {
  throw new Error('garantias do staging ausentes');
}
process.stdout.write(commit);
NODE
}'''

text = text[:validate_start] + new_validate_release_markers + text[validate_end:]

replace_once(
    '''  activation_allowed="NAO"
  if [[ -f "$sudoers_file" ]] &&
    /usr/bin/grep -Fqx "codex ALL=(root) NOPASSWD: $allowed_activate_command" "$sudoers_file"; then
    activation_allowed="SIM"
  fi

  echo "HELPER=OK"
  echo "MODO=STAGING_LOCAL_RESTRITO"''',
    '''  activation_allowed="NAO"
  operational_mode="STAGING_LOCAL_RESTRITO"
  if [[ -f "$sudoers_file" ]] &&
    /usr/bin/grep -Fqx "codex ALL=(root) NOPASSWD: $allowed_activate_command" "$sudoers_file" &&
    load_activation_permit >/dev/null 2>&1; then
    activation_allowed="SIM"
    operational_mode="ATIVACAO_TRANSACIONAL_RESTRITA"
  fi

  echo "HELPER=OK"
  echo "MODO=$operational_mode"'''
)

replace_once(
    '''if [[ "$action" == "activate" ]]; then
  [[ "$#" -eq 4 ]] || die "uso: vitalismen-stage activate TAG RELEASE RELEASE_ANTERIOR"

  deploy_tag="$2"
  release_name="$3"
  previous_release_name="$4"

  [[ "$deploy_tag" == "$allowed_activate_tag" ]] || die "tag não autorizada"
  [[ "$release_name" == "$allowed_activate_release" ]] || die "release não autorizada"
  [[ "$previous_release_name" == "$allowed_previous_release" ]] || die "baseline de rollback não autorizado"

  release_dir="$releases_dir/$release_name"
  previous_dir="$releases_dir/$previous_release_name"''',
    '''if [[ "$action" == "activate" ]]; then
  [[ "$#" -eq 1 ]] || die "uso: vitalismen-stage activate"
  load_activation_permit >/dev/null 2>&1 || die "autorização root ausente, inválida ou expirada"

  deploy_tag="$permit_tag"
  candidate_commit_authorized="$permit_commit"
  release_name="$permit_release"
  previous_release_name="$permit_rollback"
  current_expected_name="$permit_current_expected"
  permit_sha_before="$(sha256sum "$permit_file" | awk '{print $1}')"

  authorized_tag="$deploy_tag"
  authorized_commit="$candidate_commit_authorized"
  authorized_release="$release_name"
  authorized_rollback="$previous_release_name"
  authorized_current="$current_expected_name"
  [[ "$authorized_current" == "$authorized_rollback" ]] ||
    die "CURRENT_ESPERADO diverge do rollback autorizado"

  release_dir="$releases_dir/$release_name"
  previous_dir="$releases_dir/$previous_release_name"'''
)

replace_once(
    '''  candidate_commit="$(validate_release_markers "$release_dir")"
  [[ "${candidate_commit:0:7}" == "${deploy_tag##*-}" ]] || die "commit não corresponde à tag"''',
    '''  candidate_commit="$(
    validate_release_markers \
      "$release_dir" \
      "$deploy_tag" \
      "$candidate_commit_authorized" \
      "$release_name"
  )"
  [[ "$candidate_commit" == "$candidate_commit_authorized" ]] ||
    die "commit completo não autorizado"
  [[ "${candidate_commit:0:7}" == "${deploy_tag##*-}" ]] ||
    die "commit não corresponde à tag"'''
)

replace_once(
    '''  trap activation_error ERR

  echo "ATIVACAO_TRANSACIONAL_INICIADA=SIM"''',
    '''  trap activation_error ERR

  [[ "$(sha256sum "$permit_file" | awk '{print $1}')" == "$permit_sha_before" ]] ||
    die "autorização root mudou durante o preflight"
  load_activation_permit >/dev/null 2>&1 ||
    die "autorização root expirou ou divergiu antes da ativação"
  [[ "$permit_tag" == "$authorized_tag" ]] || die "tag do permit mudou"
  [[ "$permit_commit" == "$authorized_commit" ]] || die "commit do permit mudou"
  [[ "$permit_release" == "$authorized_release" ]] || die "release do permit mudou"
  [[ "$permit_rollback" == "$authorized_rollback" ]] || die "rollback do permit mudou"
  [[ "$permit_current_expected" == "$authorized_current" ]] || die "CURRENT_ESPERADO mudou"

  permit_consumed="$state_dir/.activate-permit.consumed.$$"
  [[ ! -e "$permit_consumed" && ! -L "$permit_consumed" ]] ||
    die "marcador temporário de consumo já existe"
  /usr/bin/mv -T "$permit_file" "$permit_consumed"
  [[ ! -e "$permit_file" && ! -L "$permit_file" ]] ||
    die "não foi possível consumir a autorização de uso único"
  /usr/bin/rm -f -- "$permit_consumed"

  echo "ATIVACAO_TRANSACIONAL_INICIADA=SIM"'''
)

path.write_text(text, encoding="utf-8")
PY

bash -n "$HELPER_CANDIDATE"
grep -Fqx 'allowed_activate_command="/usr/local/sbin/vitalismen-stage activate"' "$HELPER_CANDIDATE"
grep -Fqx '  [[ "$#" -eq 1 ]] || die "uso: vitalismen-stage activate"' "$HELPER_CANDIDATE"
grep -Fq 'flock -n 9' "$HELPER_CANDIDATE"
grep -Fq 'activation_error()' "$HELPER_CANDIDATE"
grep -Fq 'ROLLBACK_EXECUTADO=SIM' "$HELPER_CANDIDATE"
grep -Fq 'run_protected senior_check' "$HELPER_CANDIDATE"
grep -Fq 'run_protected freeze_lock' "$HELPER_CANDIDATE"
! grep -Fq 'allowed_activate_tag=' "$HELPER_CANDIDATE"
! grep -Fq 'allowed_activate_commit=' "$HELPER_CANDIDATE"
! grep -Fq 'allowed_activate_release=' "$HELPER_CANDIDATE"
! grep -Fq 'allowed_previous_release=' "$HELPER_CANDIDATE"

python3 - "$SUDOERS_CANDIDATE" <<'PY'
import sys
from pathlib import Path

content = """codex ALL=(root) NOPASSWD: /usr/local/sbin/vitalismen-stage status
codex ALL=(root) NOPASSWD: /usr/local/sbin/vitalismen-stage stage production-20260817-46a81f5 20260817T235735Z_production-20260817-46a81f5
codex ALL=(root) NOPASSWD: /usr/local/sbin/vitalismen-stage activate
"""
Path(sys.argv[1]).write_text(content, encoding="utf-8")
PY

chown root:root "$SUDOERS_CANDIDATE"
chmod 0440 "$SUDOERS_CANDIDATE"
visudo -cf "$SUDOERS_CANDIDATE"
! grep -Fq '*' "$SUDOERS_CANDIDATE"
grep -Fqx 'codex ALL=(root) NOPASSWD: /usr/local/sbin/vitalismen-stage activate' "$SUDOERS_CANDIDATE"
! grep -Eq 'vitalismen-stage activate[[:space:]]+[^[:space:]]' "$SUDOERS_CANDIDATE"

readonly CREATED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
readonly EXPIRES_AT="$(date -u -d '+30 minutes' +%Y-%m-%dT%H:%M:%SZ)"

node - \
  "$PERMIT_CANDIDATE" \
  "$CREATED_AT" \
  "$EXPIRES_AT" \
  "$TAG" \
  "$COMMIT" \
  "$RELEASE" \
  "$ROLLBACK" \
  "$CURRENT_EXPECTED" <<'NODE'
const fs = require('node:fs');
const [
  outputPath,
  createdAt,
  expiresAt,
  tag,
  commit,
  release,
  rollback,
  currentExpected
] = process.argv.slice(2);
const permit = {
  version: 1,
  status: 'authorized',
  singleUse: true,
  tag,
  commit,
  release,
  rollback,
  currentExpected,
  createdAt,
  expiresAt
};
fs.writeFileSync(outputPath, `${JSON.stringify(permit, null, 2)}\n`, {
  encoding: 'utf8',
  mode: 0o600,
  flag: 'wx'
});
NODE

chown root:root "$PERMIT_CANDIDATE"
chmod 0600 "$PERMIT_CANDIDATE"
[[ "$(stat -c '%U:%G:%a' "$PERMIT_CANDIDATE")" == "root:root:600" ]] ||
  die "permissões do permit candidato inválidas"

install -o root -g root -m 0755 "$HELPER_CANDIDATE" "$HELPER"
install -o root -g root -m 0440 "$SUDOERS_CANDIDATE" "$SUDOERS_FILE"
install -o root -g root -m 0600 "$PERMIT_CANDIDATE" "$PERMIT_FILE"

bash -n "$HELPER"
[[ "$(stat -c '%U:%G:%a' "$HELPER")" == "root:root:755" ]] || die "helper instalado com permissões inválidas"
[[ "$(stat -c '%U:%G:%a' "$SUDOERS_FILE")" == "root:root:440" ]] || die "sudoers instalado com permissões inválidas"
[[ "$(stat -c '%U:%G:%a' "$PERMIT_FILE")" == "root:root:600" ]] || die "permit instalado com permissões inválidas"
visudo -cf /etc/sudoers

status_output="$(sudo -u codex sudo -n "$HELPER" status)"
grep -Fqx 'ATIVACAO_PERMITIDA=SIM' <<<"$status_output" ||
  die "status final não liberou a ativação"

installation_complete=1
printf '%s\n' "$status_output"
echo "INSTALADOR=$INSTALLER_ID"
echo "BACKUP_PROTEGIDO=$BACKUP_DIR"

trap - EXIT
cleanup_and_restore
