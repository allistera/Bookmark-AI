# Automated Release Process

This repository uses GitHub Actions to automatically create releases when version changes are detected.

## How It Works

The release workflow (`.github/workflows/release.yml`) automatically:

1. **Detects version changes** in `manifest.json` when pushed to `main`
2. **Checks if the release already exists** to avoid duplicates
3. **Builds the extension package** as a zip file
4. **Generates release notes** from commit messages since the last release
5. **Creates a GitHub Release** with the version tag (e.g., `v2.0.0`)
6. **Uploads the extension package** as a release asset

## Creating a New Release

### Method 1: Automatic (Recommended)

1. Update the `version` field in both `manifest.json` and `package.json`:
   ```json
   {
     "version": "2.1.0"
   }
   ```

2. Commit and push to `main`:
   ```bash
   git add manifest.json package.json
   git commit -m "chore: bump version to 2.1.0"
   git push origin main
   ```

3. The release workflow will automatically:
   - Create a git tag `v2.1.0`
   - Generate release notes from commits
   - Create a GitHub Release
   - Upload `bookmark-ai-v2.1.0.zip`

### Method 2: Manual Trigger

You can manually trigger a release from the GitHub Actions tab:

1. Go to **Actions** → **Create Release**
2. Click **Run workflow**
3. Optionally specify a version (or leave empty to use `manifest.json` version)
4. Click **Run workflow**

### Method 3: Manual Tag (Legacy)

The old `build.yml` workflow still supports manual tag creation:

```bash
git tag v2.1.0
git push origin v2.1.0
```

## Release Notes

Release notes are automatically generated from commit messages between releases. To make them meaningful:

- Use conventional commits (e.g., `feat:`, `fix:`, `chore:`)
- Write descriptive commit messages
- Avoid merge commits in release notes (they're filtered out)

## Versioning

This project follows [Semantic Versioning](https://semver.org/):

- **MAJOR** version for incompatible API changes
- **MINOR** version for new functionality (backwards-compatible)
- **PATCH** version for backwards-compatible bug fixes

Example: `2.1.0` = Major.Minor.Patch

## Important Notes

- **Always update both** `manifest.json` and `package.json` versions together
- The workflow prevents duplicate releases (checks if tag exists)
- Release artifacts are kept for 90 days
- Build artifacts (from PRs) are kept for 30 days
