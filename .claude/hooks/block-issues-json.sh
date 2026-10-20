#!/usr/bin/env bash
# PreToolUse hook: prevents the agent from reading scripts/issues.json.
# Exit code 2 blocks the tool call and sends stderr back to Claude.

input=$(cat)

tool_name=$(jq -r '.tool_name // empty' <<<"$input")

case "$tool_name" in
  Read)
    target=$(jq -r '.tool_input.file_path // empty' <<<"$input")
    ;;
  Grep | Glob)
    target=$(jq -r '[.tool_input.path, .tool_input.glob, .tool_input.pattern] | map(select(. != null)) | join(" ")' <<<"$input")
    ;;
  Bash)
    target=$(jq -r '.tool_input.command // empty' <<<"$input")
    ;;
  *)
    exit 0
    ;;
esac

if [[ "$target" == *issues.json* ]]; then
  echo "Access to issues.json is blocked by a project hook. Do not try to read this file." >&2
  exit 2
fi

exit 0
