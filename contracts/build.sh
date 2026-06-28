#!/usr/bin/env bash
# Reproducibly build the catalog of deployable contract WASM.
#
# OpenZeppelin's stellar-contracts ships NO prebuilt WASM (release assets are
# empty) — it is a cargo workspace of Rust crates plus an examples/ directory of
# deployable contracts. We compile a curated set of those examples ONCE here and
# commit the resulting .wasm. The server deploys the committed WASM and passes
# the user's config to each contract's `__constructor`; it never runs Rust.
#
# Requirements (build machine only, NOT the server):
#   - rust + cargo, target wasm32-unknown-unknown
#   - stellar-cli >= 25.2.0  (soroban-sdk 26 needs experimental_spec_shaking_v2)
#
# Usage: ./contracts/build.sh
set -euo pipefail

OZ_REPO="https://github.com/OpenZeppelin/stellar-contracts.git"
OZ_TAG="v0.7.2"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$HERE/.oz-src"
OUT="$HERE/wasm"

# Curated catalog: <cargo package> -> <output wasm name>.
# Add a line here + a manifest in contracts/manifests/ to offer a new contract.
CATALOG=(
  "ownable-example:ownable"
  "fungible-pausable-example:fungible-token"
  "nft-sequential-minting-example:nft"
)

if [ ! -d "$SRC/.git" ]; then
  echo "→ Cloning OpenZeppelin stellar-contracts $OZ_TAG …"
  git clone --depth 1 --branch "$OZ_TAG" "$OZ_REPO" "$SRC"
fi

mkdir -p "$OUT"
for entry in "${CATALOG[@]}"; do
  pkg="${entry%%:*}"
  name="${entry##*:}"
  echo "→ Building $pkg → wasm/$name.wasm"
  ( cd "$SRC" && stellar contract build --package "$pkg" >/dev/null )
  # stellar-cli emits the package name with underscores under wasm32v1-none.
  wasm="$SRC/target/wasm32v1-none/release/${pkg//-/_}.wasm"
  cp "$wasm" "$OUT/$name.wasm"
  printf "   %s  (%s bytes)\n" "$(shasum -a 256 "$OUT/$name.wasm" | cut -c1-16)" "$(wc -c <"$OUT/$name.wasm" | tr -d ' ')"
done

echo "✅ Catalog built into contracts/wasm/"
