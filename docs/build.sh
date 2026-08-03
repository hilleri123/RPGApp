#!/usr/bin/env bash
#
# Собирает документацию из docs/src в docs/out и кладёт руководство
# пользователя в public/ фронтенда, откуда его отдаёт раздел «Контакты».
#
#   ./docs/build.sh              — собрать обе книги и обновить public/
#   ./docs/build.sh user         — только руководство пользователя
#   ./docs/build.sh tech         — только техническую документацию
#   ./docs/build.sh --no-publish — не копировать PDF в public/
#
set -euo pipefail

DOCS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$DOCS_DIR/src"
OUT_DIR="$DOCS_DIR/out"
PUBLIC_PDF="$DOCS_DIR/../RPGWebMainClient/public/rpg-master-user-guide.pdf"

ENGINE="${LATEX_ENGINE:-xelatex}"
PUBLISH=1
TARGETS=()

for arg in "$@"; do
    case "$arg" in
        --no-publish) PUBLISH=0 ;;
        user|tech)    TARGETS+=("$arg") ;;
        *) echo "Неизвестный аргумент: $arg" >&2; exit 2 ;;
    esac
done
[ ${#TARGETS[@]} -eq 0 ] && TARGETS=(user tech)

if ! command -v "$ENGINE" >/dev/null 2>&1; then
    cat >&2 <<EOF
Не найден $ENGINE. Установите TeX Live с поддержкой кириллицы:

    sudo apt install texlive-xetex texlive-lang-cyrillic fonts-dejavu

Либо укажите другой движок: LATEX_ENGINE=pdflatex ./docs/build.sh
EOF
    exit 1
fi

# \include пишет .aux рядом с исходником, поэтому в out нужно заранее
# повторить дерево каталогов chapters — иначе сборка падает на первой главе.
mkdir -p "$OUT_DIR"
(cd "$SRC_DIR" && find chapters -type d) | while read -r dir; do
    mkdir -p "$OUT_DIR/$dir"
done

build() {
    local name="$1"
    echo "==> Сборка $name.tex"
    cd "$SRC_DIR"
    # Два прохода: первый собирает оглавление и метки, второй их подставляет.
    for pass in 1 2; do
        if ! "$ENGINE" -interaction=nonstopmode -output-directory="$OUT_DIR" "$name.tex" \
                > "$OUT_DIR/$name.pass$pass.log" 2>&1; then
            echo "Сборка $name упала на проходе $pass. Последние строки лога:" >&2
            tail -30 "$OUT_DIR/$name.log" >&2
            return 1
        fi
    done
    echo "    готово: out/$name.pdf ($(du -h "$OUT_DIR/$name.pdf" | cut -f1))"
}

for target in "${TARGETS[@]}"; do
    case "$target" in
        user) build user-guide ;;
        tech) build tech-guide ;;
    esac
done

if [ "$PUBLISH" -eq 1 ] && [ -f "$OUT_DIR/user-guide.pdf" ]; then
    cp "$OUT_DIR/user-guide.pdf" "$PUBLIC_PDF"
    echo "==> Опубликовано: RPGWebMainClient/public/$(basename "$PUBLIC_PDF")"
    echo "    Не забудьте закоммитить PDF — сайт отдаёт его статикой."
fi
