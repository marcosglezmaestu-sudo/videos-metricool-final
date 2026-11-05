#!/usr/bin/env bash
# Temporary public URL for Metricool (it copies the video when the post is scheduled).
# usage: ./bridge.sh push <file.mp4> <name.mp4>   -> prints the raw URL
#        ./bridge.sh clear                         -> empties the branch again (normal push, never -f)
set -euo pipefail
REPO_DIR="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
WT=/tmp/ck-bridge
URL_BASE=https://raw.githubusercontent.com/marcosglezmaestu-sudo/videos-metricool-final/cubed
if [ ! -d "$WT/.git" ] && [ ! -f "$WT/.git" ]; then
  git -C "$REPO_DIR" fetch -q --depth 1 origin cubed
  git -C "$REPO_DIR" worktree add -q -f "$WT" FETCH_HEAD
fi
cd "$WT"; git config user.email marcos.glezmaestu@gmail.com; git config user.name Marcos
case "$1" in
  push)
    cp "$2" "$3"; git add "$3"; git commit -qm "cubed: $3"; git push -q origin HEAD:cubed
    for i in 1 2 3 4 5 6; do code=$(curl -s -o /dev/null -w '%{http_code}' -I "$URL_BASE/$3"); [ "$code" = 200 ] && break; sleep 10; done
    echo "$URL_BASE/$3" ;;
  clear)
    if ls *.mp4 >/dev/null 2>&1; then git rm -q *.mp4; git commit -qm "cubed: vacio"; git push -q origin HEAD:cubed; fi
    echo cleared ;;
esac
