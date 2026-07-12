$ErrorActionPreference="Stop"
New-Item -ItemType Directory -Force -Path "codex-skills" | Out-Null
Set-Location "codex-skills"

$repos=@(
"https://github.com/openai/skills.git",
"https://github.com/ComposioHQ/awesome-codex-skills.git",
"https://github.com/jMerta/codex-skills.git"
)

foreach($repo in $repos){
  $name=[System.IO.Path]::GetFileNameWithoutExtension($repo)
  if(-not (Test-Path $name)){
    git clone $repo
  } else {
    Write-Host "$name already exists, skipping."
  }
}
Write-Host "Done. Review each repository for installation instructions."
