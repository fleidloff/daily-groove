#!/usr/bin/env bash
# Claude Code's Bash tool and its hooks have no controlling terminal, so walk up
# to the tty the claude process owns and write the OSC 0 sequence there.
set -u

BUSY="◐"
IDLE="✳"
DONE="✔"
ASKED="?"

mode="text"
case "${1-}" in
  --busy) mode="busy" ;;
  --idle) mode="idle" ;;
  --done) mode="done" ;;
  --reset) mode="reset" ;;
  --agent-start) mode="agent-start" ;;
  --agent-stop) mode="agent-stop" ;;
esac

dev=""
name=""
pid=$$
while [ "${pid:-0}" -gt 1 ]; do
  t=$(ps -o tty= -p "$pid" 2>/dev/null | tr -d ' ')
  case "$t" in
    ''|'??') ;;
    *) dev="/dev/$t"; name=${t//\//-}; break ;;
  esac
  pid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
done
[ -n "$dev" ] || exit 0

root=$(cd "$(dirname "$0")/../.." 2>/dev/null && pwd)

state="$HOME/.claude/title-state"
mkdir -p "$state" 2>/dev/null
file="$state/$name"
agents="$file.agents"
stopped="$file.stopped"
finished="$file.done"

agent_count() {
  set -- "$agents"/*
  [ -e "$1" ] || return 0
  echo $#
}

# The tab says whose move it is. A turn that ends with a question still
# unticked in the spec the session is on is the user's move, and ✔ hides that.
spec_files() {
  case "$1" in
    Q[0-9]*) printf '%s\n' "$root/specs/quick/${1#Q}"-*.md ;;
    F*)      printf '%s\n' "$root/specs/features/feature-${1#F}"/*.md \
                            "$root/specs/features/feature-${1#F}"/*/*.md ;;
  esac
}

open_questions() {
  [ -n "$root" ] || return 1
  tag=${text%%)*}
  [ "$tag" != "$text" ] || return 1

  files=""
  for f in $(spec_files "$tag"); do
    [ -f "$f" ] && files="$files $f"
  done
  [ -n "$files" ] || return 1

  # A question is open until one of its options is ticked. Answered ones keep
  # their unticked options, so a bare `- [ ]` proves nothing on its own.
  awk '
    FNR == 1 { if (insec && pending && !ticked) open = 1; insec = 0; pending = 0; ticked = 0 }
    /^## / {
      if (insec && pending && !ticked) open = 1
      insec = ($0 ~ /^## Open questions/)
      pending = 0; ticked = 0; next
    }
    insec && /^### / { if (pending && !ticked) open = 1; pending = 1; ticked = 0; next }
    insec && /^[[:space:]]*- \[[xX]\]/ { ticked = 1 }
    END { if (insec && pending && !ticked) open = 1; if (open) print "open" }
  ' $files 2>/dev/null | grep -q open
}

end_glyph() {
  case "$1" in
    done) if open_questions; then printf '%s' "$ASKED"; else printf '%s' "$DONE"; fi ;;
    *)    printf '%s' "$IDLE" ;;
  esac
}

case "$mode" in
  reset)   rm -rf "$agents" "$stopped" "$finished" 2>/dev/null ;;
  busy)    rm -f "$stopped" "$finished" 2>/dev/null ;;
  agent-start)
    mkdir -p "$agents" 2>/dev/null
    mktemp "$agents/XXXXXX" >/dev/null 2>&1
    ;;
  agent-stop)
    for token in "$agents"/*; do
      [ -e "$token" ] && rm -f "$token" 2>/dev/null
      break
    done
    ;;
esac

running=$(agent_count)
running=${running:-0}

if [ "$mode" = "text" ]; then
  text="$*"
  [ -n "$text" ] || exit 0
  printf '%s' "$text" > "$file" 2>/dev/null
  rm -f "$finished" 2>/dev/null
  glyph="$BUSY"
else
  text=$(cat "$file" 2>/dev/null)
  [ -n "$text" ] || text="claude"
  case "$mode" in
    busy|agent-start) glyph="$BUSY" ;;
    idle|done|reset)
      if [ "$running" -gt 0 ]; then
        printf '%s' "$mode" > "$stopped" 2>/dev/null
        glyph="$BUSY"
      elif [ "$mode" = "idle" ] && [ -e "$finished" ]; then
        glyph=$(end_glyph done)
      else
        rm -f "$stopped" 2>/dev/null
        [ "$mode" = "done" ] && : > "$finished" 2>/dev/null
        glyph=$(end_glyph "$mode")
      fi
      ;;
    agent-stop)
      if [ "$running" -eq 0 ] && [ -e "$stopped" ]; then
        deferred=$(cat "$stopped" 2>/dev/null)
        rm -f "$stopped" 2>/dev/null
        [ "$deferred" = "done" ] && : > "$finished" 2>/dev/null
        glyph=$(end_glyph "${deferred:-idle}")
      else
        glyph="$BUSY"
      fi
      ;;
  esac
fi

printf '\033]0;%s %s\007' "$glyph" "$text" > "$dev" 2>/dev/null
exit 0
