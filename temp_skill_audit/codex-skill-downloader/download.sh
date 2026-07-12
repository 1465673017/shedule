#!/usr/bin/env bash
set -e
mkdir -p codex-skills
cd codex-skills

repos=(
"https://github.com/openai/skills.git"
"https://github.com/ComposioHQ/awesome-codex-skills.git"
"https://github.com/jMerta/codex-skills.git"
)

for repo in "${repos[@]}"; do
  name=$(basename "$repo" .git)
  if [ ! -d "$name" ]; then
    git clone "$repo"
  else
    echo "$name already exists, skipping."
  fi
done

echo "Done. Review the repositories and install the individual skills you want according to each project's documentation."
