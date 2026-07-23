# climail skill

An [agent skill](https://www.skills.sh/) that teaches AI coding agents to use
`climail`. It's one file — [`climail/SKILL.md`](climail/SKILL.md) — in the `SKILL.md`
format that Claude Code, Codex, GitHub Copilot, Cursor, and others read.

## Install

```bash
npx skills add nicodevs/climail
```

This uses the [skills.sh](https://www.skills.sh/) CLI, which finds the skill in
this repo and installs it for whichever agents you have set up.

## Manual install

A skill is a folder with a Markdown file, so copy it by hand if you prefer:

```bash
cp -r skills/climail ~/.claude/skills/climail          # Claude Code
cp -r skills/climail "${CODEX_HOME:-~/.codex}/skills/"  # Codex
```

For agents that read a single instructions file instead — Copilot's
`.github/copilot-instructions.md`, an `AGENTS.md`, a system prompt — append it:

```bash
cat skills/climail/SKILL.md >> AGENTS.md
```

Start a new session, then ask the agent to check your inbox.
