# climail

Read an IMAP inbox and manage messages from the command line. All data commands print JSON to stdout.

## Usage

```bash
npx climail <command>
```

## Commands

| Command | Description |
|---------|-------------|
| `init` | Setup wizard for your IMAP credentials. Creates a `.env` file with your settings. |
| `list` | List recent messages as JSON, including each message's UID. Flags: `--count <n>` (default 10), `--unread` (unread only). |
| `search` | Search the inbox. Flags: `--from`, `--to`, `--subject`, `--body`, `--text`, `--since <date>`, `--before <date>`, `--unread`, `--count <n>` (default 25). With no criteria, returns the most recent messages. |
| `labels` | List available labels/folders, with special-use flags. Flag: `--counts` adds total and unread message counts per label (one extra round trip each). |
| `read <uid>` | Fetch one message by UID — parsed body (text + html) and attachment metadata. Flag: `--save-attachments <dir>` writes attachments to disk and returns their paths. |
| `label <uid> <name>` | Apply a Gmail label to a message. Gmail labels are mailboxes, so the message is copied into the label (it stays in the Inbox). Creates the label if needed. |
| `mark <uid> <action>` | Set message flags. Actions: `read`/`unread` (toggle `\Seen`), `flag`/`unflag` and the aliases `star`/`unstar` (toggle `\Flagged`). |
| `draft-reply <uid>` | Stage a threaded reply to a message in the Drafts folder. Flags: `--body "<text>"`, `--all` (reply to everyone — sender in To, other recipients in Cc). **Drafts only — nothing is sent** (IMAP cannot send; that needs SMTP). Review and send from your mail client. |
| `send` | Send mail over SMTP (requires `SMTP_HOST`). Three modes: a new email (`--to`, `--subject`, `--body`); a threaded reply (`--to`, `--reply-to <uid>`, `--body` — carries `In-Reply-To`/`References`, add `--all` for reply-all); or an existing draft (`--draft <uid>`, which sends it and removes it from Drafts). Extras for new/reply: `--cc a,b`, `--bcc a,b`, `--html "<p>…"`, `--attach file1,file2`. |
| `forward <uid>` | Forward a message to a new recipient over SMTP. Flags: `--to <address>` (required), `--body "<note>"`. Keeps the original's attachments. |
| `delete <uid>` | Delete a message. On Gmail this moves it to Trash. |
| `archive <uid>` | Archive a message. On Gmail this drops the Inbox label (keeping it in All Mail) rather than trashing it; on other servers it moves to the Archive folder. |
| `move <uid> <mailbox>` | Move a message from the Inbox to another mailbox. |

## Examples

```bash
npx climail init
npx climail list --unread
npx climail search --from boss@work.com --since 2026-06-01 --unread
npx climail labels --counts
npx climail read 167 --save-attachments ./att
npx climail mark 167 read
npx climail label 167 Triaged
npx climail draft-reply 167 --all --body "Thanks, will take a look."
npx climail send --to them@example.com --reply-to 167 --all --body "On it."
npx climail send --to a@b.com --subject "Report" --body "Attached." --attach ./report.pdf
npx climail forward 167 --to colleague@work.com --body "FYI"
npx climail archive 167
```

## Configuration

Run `npx climail init` to create a `.env` file in the current directory, or write one yourself:

```
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_ENCRYPTION=ssl
IMAP_USERNAME=you@gmail.com
IMAP_PASSWORD="app password here"

# Optional — only needed for the `send` command
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
```

SMTP authenticates with the same username/password as IMAP.

Values are read from `.env` in the current directory, falling back to ambient environment variables. Point at a different file with `--config <path>` on any command:

```bash
npx climail list --config ~/secrets/mail.env --unread
```

> Gmail requires an **app password**, not your account password. The `.env` file is gitignored — keep it out of version control.

Requires Node >= 22.
