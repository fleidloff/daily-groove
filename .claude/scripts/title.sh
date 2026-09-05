#!/usr/bin/env bash
# Claude Code's Bash tool and its hooks have no controlling terminal, so walk up
# to the tty the claude process owns and write the OSC 0 sequence there.
set -u

BUSY="◐"
IDLE="✳"

mode="text"
case "${1-}" in
  --busy) mode="busy" ;;
  --idle) mode="idle" ;;
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

state="$HOME/.claude/title-state"
mkdir -p "$state" 2>/dev/null
file="$state/$name"

if [ "$mode" = "text" ]; then
  text="$*"
  [ -n "$text" ] || exit 0
  printf '%s' "$text" > "$file" 2>/dev/null
  glyph="$BUSY"
else
  text=$(cat "$file" 2>/dev/null)
  [ -n "$text" ] || text=$(basename "$PWD")
  [ "$mode" = "busy" ] && glyph="$BUSY" || glyph="$IDLE"
fi

printf '\033]0;%s %s\007' "$glyph" "$text" > "$dev" 2>/dev/null
exit 0
