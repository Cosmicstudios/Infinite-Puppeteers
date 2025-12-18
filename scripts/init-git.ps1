<#
init-git.ps1
Initializes a git repo, creates initial commit, and (optionally) creates GitHub repo via gh CLI.
Run from repository root: `.	ools\init-git.ps1 -RepoName "my-repo" -Visibility public`.
#>

param(
  [string]$RepoName = $(Split-Path -Leaf (Get-Location)),
  [ValidateSet('public','private')][string]$Visibility = 'public',
  [switch]$UseExistingRemote
)

# Check git
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Error "git is not installed or not on PATH. Run scripts/install-prereqs.ps1 first."
  exit 1
}

# Basic init
if (-not (Test-Path .git)) {
  git init
  Write-Host "Initialized git repository."
} else {
  Write-Host "Repository already initialized."
}

# Ensure .gitignore exists (we already have one in repo root)
if (-not (Test-Path .gitignore)) {
  @(
    'node_modules/',
    '.env',
    'db.json',
    'logs/',
    '.vscode/',
    'coverage/',
    'dist/',
    '*.db'
  ) | Out-File -FilePath .gitignore -Encoding utf8
  git add .gitignore
}

# Add all files and commit
git add -A
if ((git status --porcelain) -ne '') {
  git commit -m "chore: initial commit — project scaffold"
  Write-Host "Committed project files."
} else {
  Write-Host "Nothing to commit."
}

# Create remote with gh if available
if (Get-Command gh -ErrorAction SilentlyContinue) {
  if ($UseExistingRemote) {
    Write-Host "Skipping gh repo create because -UseExistingRemote provided."
  } else {
    Write-Host "Creating GitHub repository via gh: $RepoName ($Visibility)"
    gh repo create $RepoName --$Visibility --source=. --remote=origin --push
    if ($LASTEXITCODE -eq 0) {
      Write-Host "Repository created and pushed to GitHub."
    } else {
      Write-Warning "gh repo create failed. You can create repository manually and add remote."
    }
  }
} else {
  Write-Warning "GitHub CLI (gh) not found. To push to GitHub: create a repo manually and run:\n git remote add origin https://github.com/<your-org>/$RepoName.git\n git push -u origin main"
}

Write-Host "init-git complete."