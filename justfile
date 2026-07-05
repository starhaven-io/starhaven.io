# Build

# Build the site
build:
    npm run build

# Install dependencies
install:
    npm ci --strict-allow-scripts

# Preview the built site
preview:
    npm run preview

# Start the dev server
dev:
    npm run dev

# Lint

# fleet:block audit
audit:
    zizmor --persona auditor .github/workflows/
# fleet:end

# Check formatting
format-check:
    npm run format:check

# Format files with Prettier
format:
    npm run format

# Check for typos
typos:
    typos

# Check built site links
lychee: build
    lychee --config lychee.toml --root-dir "$(pwd)/dist/client" 'dist/client/**/*.html' README.md

# Check

# Run all checks
check:
    #!/usr/bin/env bash
    set -euo pipefail
    failed=0
    skipped=()
    run() {
        echo "--- $1 ---"
        if ! "$@"; then
            failed=1
        fi
    }
    skip() {
        echo "--- $1 --- skipped ($2 not found)"
        skipped+=("$2 (brew install $3)")
    }
    if command -v typos &>/dev/null; then
        run typos
    else
        skip typos typos typos-cli
    fi
    if command -v zizmor &>/dev/null; then
        run zizmor --persona auditor .github/workflows/
    else
        skip audit zizmor zizmor
    fi
    echo "--- format-check ---"
    npm run format:check || failed=1
    echo "--- check ---"
    npm run check || failed=1
    echo "--- build ---"
    npm run build || failed=1
    echo "--- deploy-dry ---"
    WRANGLER_SEND_METRICS=false npm run deploy:dry || failed=1
    if [ ${#skipped[@]} -gt 0 ]; then
        echo ""
        echo "Checks skipped due to missing tools:"
        for tool in "${skipped[@]}"; do
            echo "  - $tool"
        done
        failed=1
    fi
    exit $failed

# fleet:block install-hooks
# Install git hooks (DCO sign-off + pre-push checks). Run once per clone.
install-hooks:
    git config core.hooksPath .githooks
# fleet:end

# fleet:block pinprick-audit
pinprick-audit:
    pinprick audit .
# fleet:end
