#!/usr/bin/env bash
set -euo pipefail

# Cria uma unica transferencia criptografada, sem escrever um tar aberto em
# disco. A senha e solicitada pelo OpenSSL no terminal e nao deve ser passada
# como argumento, salva em arquivo ou enviada em chat.

DESTINATION="${1:-$HOME/Desktop}"
HOME_DIR="${HOME:?HOME ausente}"
WORKSPACE="$HOME_DIR/Automacao Vitalismen"
REPOSITORY="$HOME_DIR/Documents/Vitalismen Automacao"

if [[ ! -d "$DESTINATION" ]]; then
    echo "Destino inexistente: $DESTINATION" >&2
    exit 1
fi

if [[ ! -d "$WORKSPACE" || ! -d "$REPOSITORY" ]]; then
    echo "Diretorio de projeto ou de backups ausente." >&2
    exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
OUTPUT="$DESTINATION/EC_TRANSFER_${STAMP}.tar.gz.enc"
TEMP_OUTPUT="${OUTPUT}.partial"
CHECKSUM="${OUTPUT}.sha256"

if [[ -e "$OUTPUT" || -e "$TEMP_OUTPUT" || -e "$CHECKSUM" ]]; then
    echo "Ja existe uma transferencia com este nome; execute novamente em alguns segundos." >&2
    exit 1
fi

cleanup() {
    rm -f "$TEMP_OUTPUT"
}
trap cleanup EXIT
umask 077

echo "Criando transferencia criptografada em: $OUTPUT"
echo "O OpenSSL pedira uma senha forte duas vezes. Ela nao aparecera na tela."
echo "A chave SSH antiga nao entra neste pacote; crie uma nova chave no Windows."

tar -C "$HOME_DIR" -czf - \
    "Automacao Vitalismen" \
    "Documents/Vitalismen Automacao" \
    | openssl enc -aes-256-cbc -salt -pbkdf2 -iter 600000 -md sha512 -out "$TEMP_OUTPUT"

mv "$TEMP_OUTPUT" "$OUTPUT"
trap - EXIT
shasum -a 256 "$OUTPUT" > "$CHECKSUM"
chmod 600 "$OUTPUT" "$CHECKSUM"

echo "Transferencia criada e verificada localmente por checksum:"
echo "  $OUTPUT"
echo "  $CHECKSUM"
echo "Copie os dois arquivos para o Windows e valide o checksum antes de extrair."
