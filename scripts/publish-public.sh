#!/usr/bin/env bash
# Mirrors this repo into a separate public repo, as a fresh commit (no shared history),
# with real photos excluded. The private repo (this one) keeps deploying the live site
# unchanged — this only ever pushes a clean working-tree snapshot elsewhere.
#
# Usage:
#   scripts/publish-public.sh [target-dir]        # sync + commit, no push
#   scripts/publish-public.sh [target-dir] --push # also push (asks for confirmation)
#
# First run: create an empty repo on GitHub, then
#   scripts/publish-public.sh ../dominikgallery-public
#   cd ../dominikgallery-public && git remote add origin <url>
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${1:-$ROOT/../dominikgallery-public}"
PUSH=false
[[ "${2:-}" == "--push" ]] && PUSH=true

mkdir -p "$TARGET"

# Real photos (src/gallery/<collection>/*.jpg) and the og preview photo are excluded —
# only the gallery.yaml *manifest* ships, so the code/structure stays visible without the
# images themselves. Adjust this list if you want more (or less) excluded.
rsync -a --delete \
  --exclude='.git/' \
  --exclude='node_modules/' \
  --exclude='dist/' \
  --exclude='.astro/' \
  --exclude='.deploy/' \
  --exclude='.DS_Store' \
  --exclude='.claude/' \
  --exclude='src/gallery/*/' \
  --exclude='public/og-default.jpg' \
  "$ROOT/" "$TARGET/"

cd "$TARGET"
if [ ! -d .git ]; then
  git init -q
  git branch -m main
fi

git add -A
if git diff --cached --quiet; then
  echo "No changes to publish."
  exit 0
fi

git commit -q -m "Sync from private repo ($(date +%Y-%m-%d))"
echo "Committed to $TARGET"

if $PUSH; then
  if ! git remote get-url origin >/dev/null 2>&1; then
    echo "No 'origin' remote set on $TARGET — add one first: git remote add origin <url>"
    exit 1
  fi
  read -r -p "Push $TARGET to $(git remote get-url origin)? [y/N] " ans
  [[ "$ans" == "y" || "$ans" == "Y" ]] && git push origin HEAD
fi
