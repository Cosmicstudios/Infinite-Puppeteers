**Workspace save & restart instructions**

Purpose: quick, safe steps to back up the current workspace, ensure changes are preserved, and resume deployment after restart. Follow these steps locally on your Windows machine before rebooting.

1) Quick local backup (zip)

Open PowerShell as the same user and run (adjust paths if needed):

    cd 'e:\\oo pupteers'
    # Make a time-stamped backup in the parent folder
    $timestamp = (Get-Date).ToString('yyyyMMdd_HHmmss')
    $zipPath = "SERVICE_WEB_backup_$timestamp.zip"
    Compress-Archive -Path 'SERVICE WEB\\*' -DestinationPath $zipPath -Force
    Write-Host "Backup created: $zipPath"

2) (Optional) Commit local changes and push (if you have git & remote configured)

If you have `git` set up locally and the repo is connected to GitHub, commit and push your work now:

    cd 'e:\\oo pupteers\\SERVICE WEB'
    git add -A
    git commit -m "chore: save workspace before restart"
    git push origin main

If `git` is not installed or the remote isn't configured, the workspace changes are already saved on disk and in the backup zip above.

3) Environment / secret notes (DO NOT store secrets in files)

- Environment variables you may need after restart (set these in your shell or CI secrets, do not store them in the repo):
  - `HEROKU_API_KEY`
  - `HEROKU_APP_NAME`
  - `CLOUDFLARE_API_TOKEN` (if using the domain automation script)

4) How to resume after restart (step-by-step)

a) Restore workspace if needed (only if you used the backup zip and want to restore):

    cd 'e:\\oo pupteers'
    Expand-Archive -Path 'SERVICE_WEB_backup_YYYYMMDD_HHMMSS.zip' -DestinationPath '.' -Force

b) (Optional) Re-initialize git & push if you didn't earlier (only run if you want remote sync):

    cd 'e:\\oo pupteers\\SERVICE WEB'
    git init
    git remote add origin https://github.com/Cosmicstudios/Infinite-Puppeteers.git
    git add -A
    git commit -m "chore: resume work after restart"
    git branch -M main
    git push -u origin main

c) Verify CLIs you will use (install if missing):

    # For Windows, use winget where available
    # Git
    Get-Command git -ErrorAction SilentlyContinue || winget install --id Git.Git -e --source winget
    # Heroku CLI
    Get-Command heroku -ErrorAction SilentlyContinue || winget install --id Heroku.Heroku -e --source winget
    # Docker Desktop
    Get-Command docker -ErrorAction SilentlyContinue || Write-Host 'Install Docker Desktop from https://www.docker.com/products/docker-desktop'
    # GitHub CLI (gh)
    Get-Command gh -ErrorAction SilentlyContinue || winget install --id GitHub.cli -e --source winget

d) Re-run the local automated deploy (recommended path) after you confirm CLIs and env vars:

    cd 'e:\\oo pupteers\\SERVICE WEB'
    # Set secrets in your shell (do not paste here)
    $env:HEROKU_API_KEY = '...'
    $env:HEROKU_APP_NAME = 'my-service-web-marketplace'
    $env:CLOUDFLARE_API_TOKEN = '...'
    # Run the local deploy which builds and pushes the container and can call domain automation
    .\\scripts\\heroku-deploy-local.ps1 -ProvisionPostgres -Domain 'infinit3.cc'

e) If you prefer CI-driven deploy: ensure GitHub secrets are present and trigger the workflow after push

    # (requires `gh`) after committing and pushing
    # set secrets (example)
    # gh secret set HEROKU_API_KEY --body '<HEROKU_API_KEY>'
    # gh secret set HEROKU_APP_NAME --body 'my-service-web-marketplace'
    # trigger workflow dispatch
    # gh workflow run ci-publish.yml --repo Cosmicstudios/Infinite-Puppeteers --ref main

5) If the domain or Heroku DNS is not yet configured

- Run domain automation (will add `www.infinit3.cc` to Heroku and add CNAMEs in Cloudflare):

    $env:HEROKU_API_KEY = '...'
    $env:HEROKU_APP_NAME = 'my-service-web-marketplace'
    $env:CLOUDFLARE_API_TOKEN = '...'
    .\\scripts\\auto-deploy-domain.ps1 -Domain 'infinit3.cc' -ProvisionPostgres

6) After everything is running

- Verify health endpoints:

    Invoke-RestMethod -Uri 'https://www.infinit3.cc/api/health'
    # or
    Invoke-RestMethod -Uri 'https://my-service-web-marketplace.herokuapp.com/api/health'

7) If anything fails after restart, copy/paste the failing command output here and I'll analyze logs and propose fixes (CI run URL or Heroku logs are most helpful).

Saved files created by automation in this workspace (examples):
- `scripts/heroku-deploy-local.ps1`
- `scripts/auto-deploy-domain.ps1`
- `scripts/init-git.ps1` and other helper PS scripts
- `.github/workflows/ci-publish.yml` (CI workflow)

If you want, I can also create a scheduled task or short script that automatically runs the backup before shutdown — tell me and I'll add it.

Good luck with the restart — paste any outputs you want me to analyze after you come back and I will continue the deployment flow.
