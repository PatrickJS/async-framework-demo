# GitHub Actions Workflows

This folder contains CI and deployment workflows for the demo repo.

## Files

```txt
pages.yml
  Builds, checks, smoke-tests, packages, and deploys the GitHub Pages demo.
```

The workflow keeps action versions pinned by commit SHA and deploys the generated
`dist-pages/` artifact. Do not commit `dist-pages/`; it is rebuilt by CI.
