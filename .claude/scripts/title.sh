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

state="$HOME/.claude/title-state"
mkdir -p "$state" 2>/dev/null
file="$state/$name"
agents="$file.agents"
stopped="$file.stopped"

agent_count() {
  set -- "$agents"/*
  [ -e "$1" ] || return 0
  echo $#
}

case "$mode" in
  reset)   rm -rf "$agents" "$stopped" 2>/dev/null ;;
  busy)    rm -f "$stopped" 2>/dev/null ;;
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
  glyph="$BUSY"
else
  text=$(cat "$file" 2>/dev/null)
  [ -n "$text" ] || text=$(basename "$PWD")
  case "$mode" in
    busy|agent-start) glyph="$BUSY" ;;
    idle|reset)
      if [ "$running" -gt 0 ]; then
        : > "$stopped" 2>/dev/null
        glyph="$BUSY"
      else
        rm -f "$stopped" 2>/dev/null
        glyph="$IDLE"
      fi
      ;;
    agent-stop)
      if [ "$running" -eq 0 ] && [ -e "$stopped" ]; then
        rm -f "$stopped" 2>/dev/null
        glyph="$IDLE"
      else
        glyph="$BUSY"
      fi
      ;;
  esac
fi

printf '\033]0;%s %s\007' "$glyph" "$text" > "$dev" 2>/dev/null
exit 0
