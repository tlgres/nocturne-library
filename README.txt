Optional GitHub Pages deployment workflow

Copy:
  .github/workflows/pages.yml
into the repository root.

This repository currently uses branch: master
The workflow publishes only ./web, so tools/wizard is NOT public.

Then on GitHub:
  Settings -> Pages -> Build and deployment -> Source -> GitHub Actions

After that, every push to master deploys the web folder automatically.
