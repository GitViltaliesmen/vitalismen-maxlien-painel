#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

write_authorize_helper() {
  local output_path="$1"

  python3 - "$output_path" <<'PY'
import sys
from pathlib import Path

output = Path(sys.argv[1])
helper = r'''#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

die() {
  echo "ERRO: $*" >&2
  exit 1
}

test_mode="${VITALISMEN_AUTHORIZE_TEST_MODE:-false}"

if [[ "$test_mode" == "true" ]]; then
  [[ "${EUID}" -ne 0 ]] || die "modo de teste recusado para root"
  base_dir="${VITALISMEN_AUTHORIZE_TEST_BASE_DIR:?base sintética ausente}"
  state_dir="${VITALISMEN_AUTHORIZE_TEST_STATE_DIR:?state sintético ausente}"
  repo_url="${VITALISMEN_AUTHORIZE_TEST_REPO_URL:?repositório sintético ausente}"
  lock_file="${VITALISMEN_AUTHORIZE_TEST_LOCK_FILE:?lock sintético ausente}"
  expected_uid="$(id -u)"
  expected_gid="$(id -g)"
else
  [[ "$test_mode" == "false" ]] || die "modo de execução inválido"
  [[ "${EUID}" -eq 0 ]] || die "execute com sudo/root"
  base_dir="/opt/vitalismen-automacao"
  state_dir="/var/lib/vitalismen-deploy"
  repo_url="https://github.com/GitViltaliesmen/vitalismen-maxlien-painel.git"
  lock_file="/run/lock/vitalismen-stage.lock"
  expected_uid="0"
  expected_gid="0"
fi

releases_dir="$base_dir/releases"
current_link="$base_dir/current"
permit_file="$state_dir/activate-permit.json"

[[ "$#" -eq 1 ]] || die "uso: vitalismen-authorize TAG_DA_NOVA_RELEASE"
requested_tag="$1"
[[ "$requested_tag" =~ ^production-[0-9]{8}-[0-9a-f]{7}$ ]] ||
  die "tag fora do padrão oficial"

[[ -d "$releases_dir" && ! -L "$releases_dir" ]] || die "diretório de releases inválido"

exec 9>"$lock_file"
flock -n 9 || die "stage, activate ou authorize já está em execução"

[[ ! -e "$permit_file" && ! -L "$permit_file" ]] ||
  die "já existe uma autorização; sobrescrita recusada"

current_target="$(readlink -f "$current_link" 2>/dev/null || true)"
[[ -n "$current_target" ]] || die "current não possui destino válido"
case "$current_target" in
  "$releases_dir/"*) ;;
  *) die "current aponta para fora de releases" ;;
esac

current_name="${current_target##*/}"
[[ "$current_name" =~ ^[0-9]{8}T[0-9]{6}Z_production-[0-9]{8}-[0-9a-f]{7}$ ]] ||
  die "nome da release ativa inválido"
[[ -d "$current_target" && ! -L "$current_target" ]] || die "release ativa inválida"
[[ "$(stat -c '%u:%g:%a' "$current_target")" == "$expected_uid:$expected_gid:700" ]] ||
  die "owner ou modo da release ativa inválido"

candidate_payload="$(
  /usr/bin/node - \
    "$releases_dir" \
    "$requested_tag" \
    "$expected_uid" \
    "$expected_gid" <<'NODE'
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const [releasesDir, requestedTag, uidRaw, gidRaw] = process.argv.slice(2);
const expectedUid = Number(uidRaw);
const expectedGid = Number(gidRaw);
const releasePattern = /^[0-9]{8}T[0-9]{6}Z_production-[0-9]{8}-[0-9a-f]{7}$/;
const requestedSuffix = `_${requestedTag}`;

const mode = (stat) => stat.mode & 0o777;
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const assertOwned = (stat, expectedMode, label) => {
  if (stat.uid !== expectedUid || stat.gid !== expectedGid || mode(stat) !== expectedMode) {
    throw new Error(`${label} possui owner ou modo inválido`);
  }
};

const entries = fs.readdirSync(releasesDir, {withFileTypes: true});
const matching = entries.filter((entry) => (
  entry.isDirectory()
  && releasePattern.test(entry.name)
  && entry.name.endsWith(requestedSuffix)
));

if (matching.length !== 1) {
  throw new Error(`esperada exatamente uma release para a tag; encontradas=${matching.length}`);
}

const releaseName = matching[0].name;
const releaseDir = path.join(releasesDir, releaseName);
const releaseStat = fs.lstatSync(releaseDir);
if (!releaseStat.isDirectory() || releaseStat.isSymbolicLink()) {
  throw new Error('release candidata não é diretório real');
}
assertOwned(releaseStat, 0o700, 'release candidata');

const sourcePath = path.join(releaseDir, '.release-source.json');
const stagingPath = path.join(releaseDir, '.staging-complete.json');
for (const [file, label] of [[sourcePath, 'release-source'], [stagingPath, 'staging-complete']]) {
  const fileStat = fs.lstatSync(file);
  if (!fileStat.isFile() || fileStat.isSymbolicLink()) throw new Error(`${label} inválido`);
  assertOwned(fileStat, 0o600, label);
}

const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const staging = JSON.parse(fs.readFileSync(stagingPath, 'utf8'));
const commit = String(source.commit || '').toLowerCase();

if (source.repository !== 'GitViltaliesmen/vitalismen-maxlien-painel') throw new Error('repository inválido');
if (source.branch !== 'production') throw new Error('branch inválida');
if (source.tag !== requestedTag) throw new Error('tag dos metadados divergente');
if (source.releaseName !== releaseName) throw new Error('releaseName divergente');
if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error('commit completo inválido');
if (commit.slice(0, 7) !== requestedTag.slice(-7)) throw new Error('commit não corresponde à tag');
if (staging.status !== 'complete') throw new Error('staging incompleto');
if (String(staging.commit || '').toLowerCase() !== commit) throw new Error('commit do staging divergente');
if (staging.tag !== requestedTag) throw new Error('tag do staging divergente');
if (staging.currentUnchanged !== true || staging.pm2Unchanged !== true) {
  throw new Error('garantias do staging ausentes');
}

process.stdout.write([
  releaseName,
  commit,
  sourcePath,
  stagingPath,
  sha256(sourcePath),
  sha256(stagingPath)
].join('\t') + '\n');
NODE
)" || die "release staged não passou na validação"

IFS=$'\t' read -r \
  release_name \
  candidate_commit \
  source_path \
  staging_path \
  source_sha_before \
  staging_sha_before <<<"$candidate_payload"

[[ "$release_name" =~ ^[0-9]{8}T[0-9]{6}Z_production-[0-9]{8}-[0-9a-f]{7}$ ]] ||
  die "release descoberta inválida"
[[ "$candidate_commit" =~ ^[0-9a-f]{40}$ ]] || die "commit descoberto inválido"
[[ "$release_name" == *"_$requested_tag" ]] || die "release não corresponde à tag"
[[ "$candidate_commit" != "" ]] || die "commit ausente"
[[ "$current_name" != "$release_name" ]] || die "release solicitada já está ativa"

/usr/bin/node - \
  "$current_target/.release-source.json" \
  "$current_name" \
  "$expected_uid" \
  "$expected_gid" <<'NODE'
const fs = require('node:fs');
const [sourcePath, expectedRelease, uidRaw, gidRaw] = process.argv.slice(2);
const stat = fs.lstatSync(sourcePath);
if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('metadado da release ativa inválido');
if (stat.uid !== Number(uidRaw) || stat.gid !== Number(gidRaw) || (stat.mode & 0o777) !== 0o600) {
  throw new Error('owner ou modo do metadado ativo inválido');
}
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
if (source.repository !== 'GitViltaliesmen/vitalismen-maxlien-painel') throw new Error('repository ativo inválido');
if (source.branch !== 'production') throw new Error('branch ativa inválida');
if (source.releaseName !== expectedRelease) throw new Error('release ativa divergente');
if (!/^[0-9a-f]{40}$/.test(String(source.commit || '').toLowerCase())) {
  throw new Error('commit ativo inválido');
}
NODE

remote_production_commit="$(
  /usr/bin/git ls-remote --heads "$repo_url" refs/heads/production |
    /usr/bin/awk 'NR==1 {print tolower($1)}'
)"
remote_tag_commit="$(
  /usr/bin/git ls-remote --tags "$repo_url" "refs/tags/${requested_tag}^{}" |
    /usr/bin/awk 'NR==1 {print tolower($1)}'
)"
[[ "$remote_production_commit" == "$candidate_commit" ]] || die "production remota diverge da candidata"
[[ "$remote_tag_commit" == "$candidate_commit" ]] || die "tag remota diverge da candidata"

if [[ -e "$state_dir" ]]; then
  [[ -d "$state_dir" && ! -L "$state_dir" ]] || die "state_dir inválido"
  [[ "$(stat -c '%u:%g:%a' "$state_dir")" == "$expected_uid:$expected_gid:700" ]] ||
    die "owner ou modo do state_dir inválido"
elif [[ "$test_mode" == "true" ]]; then
  install -d -m 0700 "$state_dir"
else
  install -d -o root -g root -m 0700 "$state_dir"
fi

[[ ! -e "$permit_file" && ! -L "$permit_file" ]] ||
  die "autorização surgiu durante o preflight"

created_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
expires_at="$(date -u -d '+30 minutes' +%Y-%m-%dT%H:%M:%SZ)"
permit_tmp="$state_dir/.activate-permit.json.$$"
[[ ! -e "$permit_tmp" && ! -L "$permit_tmp" ]] || die "temporário do permit já existe"

cleanup_authorize() {
  local exit_code=$?
  trap - EXIT
  if [[ -e "$permit_tmp" || -L "$permit_tmp" ]]; then
    /usr/bin/rm -f -- "$permit_tmp"
  fi
  exit "$exit_code"
}
trap cleanup_authorize EXIT

/usr/bin/node - \
  "$permit_tmp" \
  "$requested_tag" \
  "$candidate_commit" \
  "$release_name" \
  "$current_name" \
  "$created_at" \
  "$expires_at" <<'NODE'
const fs = require('node:fs');
const [output, tag, commit, release, current, createdAt, expiresAt] = process.argv.slice(2);
const permit = {
  version: 1,
  status: 'authorized',
  singleUse: true,
  tag,
  commit,
  release,
  rollback: current,
  currentExpected: current,
  createdAt,
  expiresAt
};
fs.writeFileSync(output, `${JSON.stringify(permit, null, 2)}\n`, {
  encoding: 'utf8',
  mode: 0o600,
  flag: 'wx'
});
NODE

if [[ "$test_mode" != "true" ]]; then
  chown root:root "$permit_tmp"
fi
chmod 0600 "$permit_tmp"
[[ "$(stat -c '%u:%g:%a' "$permit_tmp")" == "$expected_uid:$expected_gid:600" ]] ||
  die "owner ou modo do permit inválido"

[[ "$(readlink -f "$current_link" 2>/dev/null || true)" == "$current_target" ]] ||
  die "current mudou durante a autorização"
[[ "$(sha256sum "$source_path" | awk '{print $1}')" == "$source_sha_before" ]] ||
  die "release-source mudou durante a autorização"
[[ "$(sha256sum "$staging_path" | awk '{print $1}')" == "$staging_sha_before" ]] ||
  die "staging-complete mudou durante a autorização"

remote_production_commit_final="$(
  /usr/bin/git ls-remote --heads "$repo_url" refs/heads/production |
    /usr/bin/awk 'NR==1 {print tolower($1)}'
)"
remote_tag_commit_final="$(
  /usr/bin/git ls-remote --tags "$repo_url" "refs/tags/${requested_tag}^{}" |
    /usr/bin/awk 'NR==1 {print tolower($1)}'
)"
[[ "$remote_production_commit_final" == "$candidate_commit" ]] ||
  die "production remota mudou durante a autorização"
[[ "$remote_tag_commit_final" == "$candidate_commit" ]] ||
  die "tag remota mudou durante a autorização"
[[ ! -e "$permit_file" && ! -L "$permit_file" ]] ||
  die "permit existente não será sobrescrito"

/usr/bin/ln "$permit_tmp" "$permit_file" || die "publicação atômica do permit recusada"
/usr/bin/unlink "$permit_tmp"

[[ -f "$permit_file" && ! -L "$permit_file" ]] || die "permit final inválido"
[[ "$(stat -c '%u:%g:%a' "$permit_file")" == "$expected_uid:$expected_gid:600" ]] ||
  die "owner ou modo do permit final inválido"

trap - EXIT
echo "AUTORIZACAO_CRIADA=SIM"
echo "TAG=$requested_tag"
echo "COMMIT=$candidate_commit"
echo "RELEASE=$release_name"
echo "ROLLBACK=$current_name"
echo "CURRENT_ESPERADO=$current_name"
echo "EXPIRA_EM=$expires_at"
echo "PERMIT_ROOT_0600=SIM"
echo "USO_UNICO=SIM"
echo "ACTIVATE_EXECUTADO=NAO"
'''

output.write_text(helper, encoding="utf-8")
PY
}

if [[ "${1:-}" == "--render-helper" ]]; then
  [[ "$#" -eq 2 ]] || {
    echo "ERRO: uso local: $0 --render-helper CAMINHO" >&2
    exit 1
  }
  render_target="$2"
  [[ ! -e "$render_target" && ! -L "$render_target" ]] || {
    echo "ERRO: destino do render já existe" >&2
    exit 1
  }
  write_authorize_helper "$render_target"
  chmod 0700 "$render_target"
  bash -n "$render_target"
  echo "HELPER_RENDERIZADO=$render_target"
  echo "PERMIT_REAL_CRIADO=NAO"
  exit 0
fi

[[ "$#" -eq 0 ]] || {
  echo "ERRO: este instalador não recebe argumentos" >&2
  exit 1
}
[[ "${EUID}" -eq 0 ]] || {
  echo "ERRO: execute o instalador como root" >&2
  exit 1
}

helper_path="/usr/local/sbin/vitalismen-authorize"
lock_file="/run/lock/vitalismen-authorize-install.lock"
run_id="$(date -u +%Y%m%dT%H%M%SZ).$$"
backup_dir="/var/backups/vitalismen-authorize/${run_id}"
candidate="/usr/local/sbin/.vitalismen-authorize.${run_id}"
had_previous=0
snapshot_complete=0
installation_complete=0

exec 8>"$lock_file"
flock -n 8 || {
  echo "ERRO: outro instalador vitalismen-authorize está em execução" >&2
  exit 1
}

install -d -o root -g root -m 0700 "$backup_dir"

rollback_installer() {
  local exit_code=$?
  trap - EXIT
  set +e
  /usr/bin/rm -f -- "$candidate"

  if [[ "$installation_complete" != "1" && "$snapshot_complete" == "1" ]]; then
    if [[ "$had_previous" == "1" ]]; then
      install -o root -g root -m 0755 "$backup_dir/vitalismen-authorize" "$helper_path"
    else
      /usr/bin/rm -f -- "$helper_path"
    fi
    echo "INSTALACAO_REVERTIDA=SIM" >&2
  fi

  exit "$exit_code"
}
trap rollback_installer EXIT

if [[ -e "$helper_path" ]]; then
  [[ -f "$helper_path" && ! -L "$helper_path" ]] || {
    echo "ERRO: helper anterior não é arquivo regular" >&2
    exit 1
  }
  had_previous=1
  install -o root -g root -m 0755 "$helper_path" "$backup_dir/vitalismen-authorize"
fi
snapshot_complete=1

[[ ! -e "$candidate" && ! -L "$candidate" ]] || {
  echo "ERRO: candidato temporário já existe" >&2
  exit 1
}
write_authorize_helper "$candidate"
chown root:root "$candidate"
chmod 0755 "$candidate"
bash -n "$candidate"

grep -Fqx '[[ "$#" -eq 1 ]] || die "uso: vitalismen-authorize TAG_DA_NOVA_RELEASE"' "$candidate"
grep -Fq 'flock -n 9' "$candidate"
grep -Fq 'sobrescrita recusada' "$candidate"
grep -Fq 'singleUse: true' "$candidate"
grep -Fq "expires_at=\"\$(date -u -d '+30 minutes'" "$candidate"
! grep -Fq '/usr/local/sbin/vitalismen-stage' "$candidate"
! grep -Eq '(^|[[:space:]])pm2([[:space:]]|$)' "$candidate"
! grep -Eq '(^|[[:space:]])nginx([[:space:]]|$)' "$candidate"
! grep -Fq 'mongosh' "$candidate"

install -o root -g root -m 0755 "$candidate" "$helper_path"
bash -n "$helper_path"
[[ "$(stat -c '%U:%G:%a' "$helper_path")" == "root:root:755" ]] || {
  echo "ERRO: helper instalado com owner ou modo inválido" >&2
  exit 1
}

installation_complete=1
echo "HELPER_INSTALADO=$helper_path"
echo "HELPER_SHA256=$(sha256sum "$helper_path" | awk '{print $1}')"
echo "BACKUP_PROTEGIDO=$backup_dir"
echo "PERMIT_REAL_CRIADO=NAO"
echo "ACTIVATE_EXECUTADO=NAO"
echo "PRODUCAO_ALTERADA=NAO"

trap - EXIT
rollback_installer
