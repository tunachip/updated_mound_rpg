#!/usr/bin/env sh
set -eu

node --experimental-strip-types tests/ai-move-balance-sweep.ts "$@"
