# GitHub Actions

This workflow template uses the `uiwitness` CLI package after the external cutover publishes it. Repository contributors can already run `corepack pnpm release:smoke` to exercise the complete built-CLI consumer gate against the fictional Northline example.

Add `uiwitness` and the documented exact Playwright version to the project's development dependencies and lock them in `package-lock.json`. Make sure `npm run build` plus `npm run start` produce and serve the application at `http://127.0.0.1:3000`. Adjust those two commands and the readiness URL for a different stack.

```yaml
name: UIWitness

on:
  pull_request:

permissions:
  contents: read

jobs:
  scan:
    name: Product-state coverage
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - name: Check out repository
        uses: actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6
      - name: Set up Node.js
        uses: actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38 # v6
        with:
          node-version: 22.20.0
          cache: npm
      - name: Install dependencies
        run: npm ci
      - name: Install Chromium
        run: npx --no-install playwright install --with-deps chromium
      - name: Build application
        run: npm run build
      - name: Start application
        run: |
          npm run start > "$RUNNER_TEMP/uiwitness-app.log" 2>&1 &
          echo $! > "$RUNNER_TEMP/uiwitness-app.pid"
      - name: Wait for application
        run: |
          for attempt in $(seq 1 60); do
            if curl --fail --silent http://127.0.0.1:3000/ > /dev/null; then
              exit 0
            fi
            sleep 1
          done
          cat "$RUNNER_TEMP/uiwitness-app.log"
          exit 1
      - name: Scan product states
        run: npx --no-install uiwitness scan
      - name: Upload UIWitness evidence
        if: ${{ always() }}
        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
        with:
          name: uiwitness-report
          path: .uiwitness
          include-hidden-files: true
          if-no-files-found: error
          retention-days: 7
```

## Exit behavior

The scan step preserves UIWitness's normal exit contract:

- `0`: every configured execution passed.
- `1`: the scan completed and one or more executions failed. The job fails, while `if: always()` still uploads the report.
- `2`: configuration, setup, or internal execution failed. The job fails and the uploaded report may be absent.

Do not convert every nonzero exit into success. Doing so hides both product-state failures and setup failures. A repository with a deliberately failing demonstration fixture may instead add its own exact known-failure validator, as UIWitness's `release:smoke` gate does for the fictional Northline example.

## Privacy

The upload step is explicit CI configuration, not UIWitness telemetry. It uploads the complete `.uiwitness` bundle because the offline HTML references screenshots in its sibling `artifacts/` directory. Reports can contain screenshots, URLs, and application data. Artifacts from a public repository must be treated as public; do not upload sensitive captures there. Use a private repository with tightly restricted read access or omit the upload step when evidence is sensitive. Always use fictional or approved test data and choose the shortest useful retention period.
