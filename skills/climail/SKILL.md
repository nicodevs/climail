---
name: climail
description: Read, send, and organize email from the command line via climail. Use whenever the user wants to check their inbox, read a message, search mail, send/reply/forward email, or triage (label, archive, mark, move, delete) messages. climail speaks IMAP + SMTP and prints JSON.
---

# climail

`climail` is a CLI email client. Every command runs through `npx` — no install needed:

```bash
npx climail <command> [args] [flags]
```

Every command prints **JSON on stdout**, so parse the output rather than scraping text. Messages are addressed by their integer **UID** (returned by `list` and `search`).

## Setup

Config lives at `~/.config/climail.conf` (IMAP credentials; SMTP only for sending). If a command fails with "No configuration found", tell the user to run `npx climail init`. Gmail requires an **app password**, not the account password.

## Commands

| Command | What it does |
|---|---|
| `list` | Recent messages as JSON with UIDs. `--count <n>` (default 10), `--unread`, `--mailbox <name>` (default INBOX). |
| `search` | Search a mailbox (default INBOX). `--from`, `--to`, `--subject`, `--body`, `--text`, `--since <date>`, `--before <date>`, `--unread`, `--count <n>`, `--mailbox <name>`. No criteria = most recent. |
| `read <uid>` | Full message: text + html body, attachment metadata. `--save-attachments <dir>` writes files and returns paths. `--mailbox <name>` to read from another folder. |
| `labels` | List labels/folders. `--counts` adds per-label totals (slower). |
| `label <uid> <name>` | Apply a Gmail label (copies into it; stays in source mailbox). Creates it if missing. `--mailbox <name>` to label from another folder. |
| `mark <uid> <action>` | Flags. Actions: `read`/`unread`, `flag`/`unflag` (aliases `star`/`unstar`). `--mailbox <name>` to mark in another folder. |
| `draft-reply <uid>` | Stage a threaded reply in Drafts — **nothing is sent**. `--body "<text>"`, `--all` (reply-all). |
| `send` | Send over SMTP (needs `smtp.host`). New: `--to --subject --body`. Reply: `--to --reply-to <uid> --body` (`--all` for reply-all). Draft: `--draft <uid>`. Extras: `--cc`, `--bcc`, `--html`, `--attach f1,f2`. |
| `forward <uid>` | Forward over SMTP. `--to <address>` (required), `--body "<note>"`. Keeps attachments. |
| `archive <uid>` | Archive (Gmail: drops Inbox label; else moves to Archive). |
| `move <uid> <mailbox>` | Move from Inbox to another mailbox. |
| `delete <uid>` | Delete (Gmail: moves to Trash). `--from <mailbox>` to delete from elsewhere. |

Add `--config <path>` to any command to use a config file other than the default.

## Typical flows

- **Triage the inbox:** `npx climail list --unread` → for each UID `npx climail read <uid>` → then `mark`, `label`, `archive`, or `draft-reply`.
- **Find something:** `npx climail search --from boss@work.com --since 2026-06-01 --unread`.
- **Work outside the Inbox:** archived/labeled mail lives in `[Gmail]/All Mail` with a different UID than it had in the Inbox. Point `list`/`search`/`read`/`mark`/`label` at it with `--mailbox`, e.g. `npx climail list --mailbox "[Gmail]/All Mail" --unread` then `npx climail mark <uid> read --mailbox "[Gmail]/All Mail"`.
- **Reply to a thread:** draft first with `draft-reply` for the user to review, or send directly with `npx climail send --to them@example.com --reply-to <uid> --body "..."`.

## Rules

- Always prefix commands with `npx climail`.
- `draft-reply` never sends — only `send` and `forward` deliver mail. Confirm with the user before sending on their behalf.
- Never print or commit the contents of `climail.conf` — it holds credentials.
