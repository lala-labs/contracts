#!/usr/bin/env bash

set -euo pipefail

# cross platform `mkdir -p`
node -e 'fs.mkdirSync("build/contracts", { recursive: true })'

cd artifacts/contracts
find . -name "*.json" -exec mv '{}' ../../build/contracts/ \;
cd ../../

cd build/contracts
find . -name "*.dbg.json" -exec rm '{}' \;
cd ../../
