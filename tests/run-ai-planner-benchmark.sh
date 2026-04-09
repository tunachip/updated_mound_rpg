#!/usr/bin/env sh

set -eu

exec node --no-warnings --experimental-strip-types tests/ai-planner-benchmark.ts "$@"
