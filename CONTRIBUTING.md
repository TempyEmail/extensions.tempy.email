# Contributing

Thanks for taking the time to contribute.

## Ways to Contribute

- Report bugs with clear repro steps and expected vs. actual behavior.
- Suggest improvements to UX, accessibility, or performance.
- Submit focused pull requests.

## Key Constraints

- **No build step** — edit source directly, reload extension to test
- **No external dependencies** — vanilla JS only (devDependencies for testing are fine)
- **Manifest sync** — changes to permissions/icons/scripts must be applied to BOTH `manifest.json` and `manifest.firefox.json`
- **Tests required** — every feature or bug fix should include a unit test (`tests/`) or integration test (`tests/integration/`), or both

## Development Setup

### Loading the extension locally

**Chrome:**
1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the repository root

**Firefox:**
1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select `manifest.firefox.json`

### Testing

**Unit tests** — pure Node.js tests using `node:test`, no browser needed:

```
npm test
```

**Integration tests (E2E)** — Playwright tests that load the real extension in Chrome and hit the live tempy.email API:

```
npm run test:integration
```

First-time setup:
```
npm install
npx playwright install chromium
```

## Git Commit Style

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <description>
```

**Types:** `feat`, `fix`, `refactor`, `chore`, `docs`, `style`, `perf`, `test`

**Examples:**
- `feat(popup): add OTP extraction from messages`
- `fix(content): overlay positioning on scroll`
- `test(integration): add inbox open flow`

## Releasing

Automated via GitHub Actions on push to `main`:
- Version format: `{major}.{minor}.{run_number}` (e.g., `1.0.42`)
- Major/minor are read from `package.json`
- Both unit and integration tests must pass before release
- Creates GitHub release with separate Chrome and Firefox zip packages

No manual build or release commands — just push to `main`.

## Pull Request Guidelines

- Keep changes small and focused on a single concern.
- Include unit or E2E tests for new behavior.
- Update documentation when behavior or UI changes.
- Avoid adding new runtime dependencies without discussion.

## Reporting Issues

Include the following when filing a bug:

- Browser name and version
- Extension version
- Reproduction steps
- Expected behavior
- Actual behavior
- Screenshots or console logs when relevant
