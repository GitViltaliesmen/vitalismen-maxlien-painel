#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

export HOME=/root
export USER=root
export LOGNAME=root
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

base_dir="/opt/vitalismen-automacao"
releases_dir="$base_dir/releases"
repo_url="https://github.com/GitViltaliesmen/vitalismen-maxlien-painel.git"
state_dir="/var/lib/vitalismen-deploy"
permit_file="$state_dir/activate-permit.json"
protected_log_dir="/var/log/vitalismen-deploy"
process_name="vitalismen-automation"
official_health_url="https://ec.maxlien.shop/api/health/"
official_panel_url="https://ec.maxlien.shop/n/"
local_health_url="http://127.0.0.1:3001/api/health/"
sudoers_file="/etc/sudoers.d/vitalismen-codex-stage"
allowed_activate_command="/usr/local/sbin/vitalismen-stage activate"

die() {
  echo "ERRO: $*" >&2
  exit 1
}

safe_label() {
  printf '%s' "$1" | tr -c 'A-Za-z0-9_-' '_'
}

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

run_protected() {
  local label
  local output_file
  label="$(safe_label "$1")"
  shift
  output_file="$protected_log_dir/${release_name}.${label}.log"
  : > "$output_file"
  chmod 600 "$output_file"

  if "$@" >"$output_file" 2>&1; then
    echo "GATE_${label}=OK"
    return 0
  fi

  echo "GATE_${label}=FALHOU"
  echo "DETALHES_PROTEGIDOS=$output_file"
  return 1
}

switch_current() {
  local target="$1"
  local next_link="$base_dir/.current.next.$$"

  [[ "$target" == "$releases_dir/"* ]] || die "destino de current fora de releases"
  [[ -d "$target" && ! -L "$target" ]] || die "destino de current inválido"
  [[ ! -e "$next_link" && ! -L "$next_link" ]] || die "link temporário já existe"

  /usr/bin/ln -s "$target" "$next_link"
  if ! /usr/bin/mv -Tf "$next_link" "$base_dir/current"; then
    /usr/bin/unlink "$next_link" 2>/dev/null || true
    return 1
  fi
}

wait_runtime_health() {
  local label="$1"
  local health_file="$protected_log_dir/${release_name}.${label}.health.json"
  local attempt
  local pid

  : > "$health_file"
  chmod 600 "$health_file"

  for attempt in $(seq 1 30); do
    pid="$(/usr/bin/pm2 pid "$process_name" 2>/dev/null | tail -n 1 || true)"
    if [[ -n "$pid" && "$pid" != "0" ]] &&
      /usr/bin/curl -fsS --max-time 8 "$local_health_url" >"$health_file" 2>&1 &&
      /usr/bin/node - "$health_file" <<'NODE'
const fs = require('node:fs');
const path = process.argv[2];
const data = JSON.parse(fs.readFileSync(path, 'utf8'));
const serialized = JSON.stringify(data).toLowerCase();
if (!serialized.includes('"online"')) process.exit(1);
NODE
    then
      if /usr/bin/curl -fsS --max-time 12 "$official_health_url" >/dev/null 2>&1 &&
        /usr/bin/curl -fsS --max-time 12 "$official_panel_url" >/dev/null 2>&1; then
        return 0
      fi
    fi
    /usr/bin/sleep 2
  done

  return 1
}

validate_release_markers() {
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
}

action="${1:-}"

if [[ "$action" == "status" ]]; then
  /bin/bash -n "$0" || {
    echo "HELPER=SINTAXE_INVALIDA"
    exit 1
  }

  current_target="$(readlink -f "$base_dir/current" 2>/dev/null || true)"
  pm2_pid="$(/usr/bin/pm2 pid "$process_name" 2>/dev/null | tail -n 1 || true)"

  activation_allowed="NAO"
  operational_mode="STAGING_LOCAL_RESTRITO"
  if [[ -f "$sudoers_file" ]] &&
    /usr/bin/grep -Fqx "codex ALL=(root) NOPASSWD: $allowed_activate_command" "$sudoers_file" &&
    load_activation_permit >/dev/null 2>&1; then
    activation_allowed="SIM"
    operational_mode="ATIVACAO_TRANSACIONAL_RESTRITA"
  fi

  echo "HELPER=OK"
  echo "MODO=$operational_mode"
  echo "CURRENT=${current_target:-AUSENTE}"
  echo "PM2_PID=${pm2_pid:-AUSENTE}"
  echo "SAIDA_SENSIVEL=PROTEGIDA"
  echo "STAGING_PERMITIDO=SIM"
  echo "ATIVACAO_PERMITIDA=$activation_allowed"
  exit 0
fi

if [[ "$action" == "activate" ]]; then
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
  previous_dir="$releases_dir/$previous_release_name"

  [[ -d "$release_dir" && ! -L "$release_dir" ]] || die "release candidata inválida"
  [[ -d "$previous_dir" && ! -L "$previous_dir" ]] || die "release anterior inválida"
  [[ "$(stat -c '%U:%G:%a' "$release_dir")" == "root:root:700" ]] || die "permissões da candidata inválidas"
  [[ -f "$release_dir/.env" ]] || die ".env da candidata ausente"
  [[ "$(stat -c '%U:%G:%a' "$release_dir/.env")" == "root:root:600" ]] || die "permissões do .env inválidas"
  [[ -f "$release_dir/.release-source.json" ]] || die "metadados da release ausentes"
  [[ -f "$release_dir/.staging-complete.json" ]] || die "marcador de staging ausente"

  current_before="$(readlink -f "$base_dir/current" 2>/dev/null || true)"
  [[ "$current_before" == "$previous_dir" ]] || die "current não aponta para o baseline autorizado"

  candidate_commit="$(
    validate_release_markers       "$release_dir"       "$deploy_tag"       "$candidate_commit_authorized"       "$release_name"
  )"
  [[ "$candidate_commit" == "$candidate_commit_authorized" ]] ||
    die "commit completo não autorizado"
  [[ "${candidate_commit:0:7}" == "${deploy_tag##*-}" ]] ||
    die "commit não corresponde à tag"

  remote_production_commit="$(/usr/bin/git ls-remote --heads "$repo_url" refs/heads/production | awk 'NR==1 {print tolower($1)}')"
  remote_tag_commit="$(/usr/bin/git ls-remote --tags "$repo_url" "refs/tags/${deploy_tag}^{}" | awk 'NR==1 {print tolower($1)}')"
  [[ "$candidate_commit" == "$remote_production_commit" ]] || die "origin/production divergiu da candidata"
  [[ "$candidate_commit" == "$remote_tag_commit" ]] || die "tag remota divergiu da candidata"

  install -d -o root -g root -m 0700 "$state_dir" "$protected_log_dir"
  exec 9>/run/lock/vitalismen-stage.lock
  flock -n 9 || die "outro staging/activate Vitalismen está em execução"

  pm2_pid_before="$(/usr/bin/pm2 pid "$process_name" 2>/dev/null | tail -n 1 || true)"
  [[ -n "$pm2_pid_before" && "$pm2_pid_before" != "0" ]] || die "PID do PM2 não identificado"

  wait_runtime_health pre_activation || die "produção atual não passou no health pré-ativação"

  activated=0
  activation_error() {
    local failure_code=$?
    local rollback_ok=0

    trap - ERR
    set +e
    echo "ATIVACAO_FALHOU=SIM"

    if [[ "$activated" == "1" ]]; then
      if switch_current "$previous_dir" &&
        run_protected rollback_pm2_restart /usr/bin/pm2 restart "$process_name" --update-env &&
        wait_runtime_health rollback; then
        run_protected rollback_pm2_save /usr/bin/pm2 save || true
        rollback_ok=1
      fi
    fi

    if [[ "$activated" == "1" && "$rollback_ok" == "1" ]]; then
      echo "ROLLBACK_EXECUTADO=SIM"
      echo "CURRENT_RESTAURADO=$(readlink -f "$base_dir/current" 2>/dev/null || true)"
      echo "PM2_PID_RESTAURADO=$(/usr/bin/pm2 pid "$process_name" 2>/dev/null | tail -n 1 || true)"
    elif [[ "$activated" == "1" ]]; then
      echo "ROLLBACK_EXECUTADO=FALHOU"
      echo "INTERVENCAO_ROOT_NECESSARIA=SIM"
    else
      echo "ROLLBACK_NAO_NECESSARIO=SIM"
    fi

    exit "$failure_code"
  }
  trap activation_error ERR

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

  echo "ATIVACAO_TRANSACIONAL_INICIADA=SIM"
  echo "COMMIT=$candidate_commit"
  echo "RELEASE=$release_dir"
  echo "ROLLBACK=$previous_dir"

  switch_current "$release_dir"
  activated=1

  run_protected pm2_restart /usr/bin/pm2 restart "$process_name" --update-env
  wait_runtime_health candidate

  run_protected post_activation_audit \
    /usr/bin/env -C "$release_dir" OFFICIAL_AUDIT_SKIP_VPS=true \
    /usr/bin/node scripts/official-state-audit.mjs

  run_protected pm2_save /usr/bin/pm2 save

  current_after="$(readlink -f "$base_dir/current" 2>/dev/null || true)"
  pm2_pid_after="$(/usr/bin/pm2 pid "$process_name" 2>/dev/null | tail -n 1 || true)"
  [[ "$current_after" == "$release_dir" ]] || {
    echo "ERRO: current não aponta para a candidata" >&2
    false
  }
  [[ -n "$pm2_pid_after" && "$pm2_pid_after" != "0" ]] || {
    echo "ERRO: novo PID do PM2 inválido" >&2
    false
  }
  [[ "$pm2_pid_after" != "$pm2_pid_before" ]] || {
    echo "ERRO: PM2 não reiniciou o processo" >&2
    false
  }

  cat > "$release_dir/.activation-complete.json" <<ACTIVATION
{
  "status": "active",
  "commit": "$candidate_commit",
  "tag": "$deploy_tag",
  "activatedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "previousRelease": "$previous_release_name",
  "rollbackAvailable": true,
  "healthValidated": true,
  "stdoutSensitiveData": "redacted"
}
ACTIVATION
  chmod 600 "$release_dir/.activation-complete.json"

  trap - ERR
  echo "ATIVACAO_OFICIAL_CONCLUIDA"
  echo "CURRENT=$current_after"
  echo "PM2_PID_ANTES=$pm2_pid_before"
  echo "PM2_PID_ATUAL=$pm2_pid_after"
  echo "HEALTH_OFICIAL=OK"
  echo "PAINEL_N=OK"
  echo "ROLLBACK_EXECUTADO=NAO"
  echo "ROLLBACK_DISPONIVEL=$previous_dir"
  echo "SAIDA_SENSIVEL=PROTEGIDA"
  exit 0
fi

[[ "$action" == "stage" ]] || die "uso: vitalismen-stage status | stage TAG RELEASE"
[[ "$#" -eq 3 ]] || die "informe exatamente TAG e RELEASE"

deploy_tag="$2"
release_name="$3"

[[ "$deploy_tag" =~ ^production-[0-9]{8}-[0-9a-f]{7}$ ]] ||
  die "tag fora do padrão oficial"

[[ "$release_name" =~ ^[0-9]{8}T[0-9]{6}Z_production-[0-9]{8}-[0-9a-f]{7}$ ]] ||
  die "nome da release fora do padrão oficial"

[[ "$release_name" == *"_${deploy_tag}" ]] ||
  die "a release não corresponde à tag"

tag_date="${deploy_tag:11:8}"
release_date="${release_name:0:8}"
[[ "$tag_date" == "$release_date" ]] ||
  die "a data da release não corresponde à tag"

release_dir="$releases_dir/$release_name"
[[ "$release_dir" == "$releases_dir/"* ]] || die "caminho da release inválido"
[[ ! -e "$release_dir" ]] || die "release já existe: $release_dir"

current_before="$(readlink -f "$base_dir/current" 2>/dev/null || true)"
[[ -n "$current_before" ]] || die "current não possui destino válido"
[[ -f "$current_before/.env" ]] || die ".env protegido ausente na release atual"

pm2_pid_before="$(pm2 pid vitalismen-automation 2>/dev/null | tail -n 1 || true)"
[[ -n "$pm2_pid_before" ]] || die "PID do PM2 não foi identificado"

install -d -o root -g root -m 0700 "$state_dir" "$protected_log_dir"

exec 9>/run/lock/vitalismen-stage.lock
flock -n 9 || die "outro staging Vitalismen está em execução"

stage_complete=0
cleanup() {
  if [[ "$stage_complete" != "1" && -n "${release_dir:-}" && -d "$release_dir" ]]; then
    case "$release_dir" in
      "$releases_dir/"[0-9]*_production-*)
        rm -rf -- "$release_dir"
        echo "RELEASE_INCOMPLETA_REMOVIDA=SIM"
        ;;
      *)
        echo "REMOCAO_RECUSADA_CAMINHO_INVALIDO=$release_dir" >&2
        ;;
    esac
  fi
}
trap cleanup EXIT

echo "STAGING_INICIADO=SIM"
echo "TAG=$deploy_tag"
echo "RELEASE=$release_name"
echo "CURRENT_ANTES=$current_before"
echo "PM2_PID_ANTES=$pm2_pid_before"

run_protected clone \
  git clone --single-branch --branch production "$repo_url" "$release_dir"

run_protected fetch_tag \
  git -C "$release_dir" fetch --force origin "refs/tags/${deploy_tag}:refs/tags/${deploy_tag}"

production_commit="$(git -C "$release_dir" rev-parse HEAD | tr 'A-F' 'a-f')"
tag_commit="$(git -C "$release_dir" rev-parse "refs/tags/${deploy_tag}^{}" | tr 'A-F' 'a-f')"
remote_production_commit="$(git ls-remote --heads "$repo_url" refs/heads/production | awk 'NR==1 {print tolower($1)}')"
remote_tag_commit="$(git ls-remote --tags "$repo_url" "refs/tags/${deploy_tag}^{}" | awk 'NR==1 {print tolower($1)}')"
origin_url="$(git -C "$release_dir" remote get-url origin)"
git_status="$(git -C "$release_dir" status --porcelain=v1 --untracked-files=all)"

[[ -z "$git_status" ]] || die "clone possui alterações inesperadas"
[[ "$origin_url" == "$repo_url" ]] || die "origin não é o repositório oficial"
[[ "$production_commit" == "$tag_commit" ]] || die "tag local não aponta para production"
[[ "$production_commit" == "$remote_production_commit" ]] || die "origin/production mudou durante o staging"
[[ "$production_commit" == "$remote_tag_commit" ]] || die "tag remota não aponta para production"
[[ "${production_commit:0:7}" == "${deploy_tag##*-}" ]] || die "SHA curto da tag não corresponde ao commit"

created_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
cat > "$release_dir/.release-source.json" <<METADATA
{
  "repository": "GitViltaliesmen/vitalismen-maxlien-painel",
  "branch": "production",
  "commit": "$production_commit",
  "tag": "$deploy_tag",
  "createdAt": "$created_at",
  "releaseName": "$release_name"
}
METADATA
chmod 600 "$release_dir/.release-source.json"

rm -rf -- "$release_dir/.git"

run_protected npm_ci \
  /usr/bin/env -C "$release_dir" /usr/bin/npm ci --omit=dev

install -o root -g root -m 0600 "$current_before/.env" "$release_dir/.env"

run_protected official_state_audit \
  /usr/bin/env -C "$release_dir" OFFICIAL_AUDIT_SKIP_VPS=true \
  /usr/bin/node scripts/official-state-audit.mjs

run_protected freeze_lock_pre \
  /usr/bin/env -C "$release_dir" /usr/bin/npm run guard:freeze-lock

run_protected senior_check \
  /usr/bin/env -C "$release_dir" /usr/bin/npm run senior:check

run_protected product_micro_layer \
  /usr/bin/env -C "$release_dir" /usr/bin/npm run guard:ec-product-micro-layer

run_protected dropi_catalog \
  /usr/bin/env -C "$release_dir" /usr/bin/npm run guard:ec-dropi-catalog

run_protected pickup_notifications \
  /usr/bin/env -C "$release_dir" /usr/bin/npm run guard:pickup-notifications

run_protected whatsapp_status_contacts \
  /usr/bin/env -C "$release_dir" /usr/bin/npm run guard:whatsapp-status-contacts

run_protected operational_labels \
  /usr/bin/env -C "$release_dir" /usr/bin/npm run test:operational-labels

run_protected pickup_notification_tests \
  /usr/bin/env -C "$release_dir" /usr/bin/npm run test:pickup-notifications

run_protected freeze_lock \
  /usr/bin/env -C "$release_dir" /usr/bin/npm run guard:freeze-lock

current_after="$(readlink -f "$base_dir/current" 2>/dev/null || true)"
pm2_pid_after="$(pm2 pid vitalismen-automation 2>/dev/null | tail -n 1 || true)"

[[ "$current_after" == "$current_before" ]] || die "current mudou durante o staging"
[[ "$pm2_pid_after" == "$pm2_pid_before" ]] || die "PID do PM2 mudou durante o staging"

cat > "$release_dir/.staging-complete.json" <<STAGING
{
  "status": "complete",
  "commit": "$production_commit",
  "tag": "$deploy_tag",
  "completedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "currentUnchanged": true,
  "pm2Unchanged": true,
  "stdoutSensitiveData": "redacted"
}
STAGING
chmod 600 "$release_dir/.staging-complete.json"

stage_complete=1
echo "STAGING_OFICIAL_CONCLUIDO"
echo "COMMIT=$production_commit"
echo "RELEASE=$release_dir"
echo "CURRENT_INALTERADO=$current_after"
echo "PM2_PID_INALTERADO=$pm2_pid_after"
echo "SAIDA_SENSIVEL=PROTEGIDA"
echo "ATIVACAO_EXECUTADA=NAO"
