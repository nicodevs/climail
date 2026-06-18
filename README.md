# emailcheck

Read an IMAP inbox and manage messages from the command line. All data commands print JSON to stdout.

## Usage

```bash
npx emailcheck <command>
```

## Commands

| Command | Description |
|---------|-------------|
| `init` | Setup wizard for your IMAP credentials. Creates a `.env` file with your settings. |
| `list` | List recent messages as JSON, including each message's UID. Flags: `--count <n>` (default 10), `--unread` (unread only). |
| `read <uid>` | Fetch one message by UID — parsed body (text + html) and attachment metadata. Flag: `--save-attachments <dir>` writes attachments to disk and returns their paths. |
| `label <uid> <name>` | Apply a Gmail label to a message. Gmail labels are mailboxes, so the message is copied into the label (it stays in the Inbox). Creates the label if needed. |
| `draft-reply <uid>` | Stage a threaded reply to a message in the Drafts folder. Flag: `--body "<text>"`. **Drafts only — nothing is sent** (IMAP cannot send; that needs SMTP). Review and send from your mail client. |
| `send` | Send a new email over SMTP. Flags: `--to <address>` (required), `--subject "<s>"`, `--body "<text>"`. Requires `SMTP_HOST` in config. |
| `delete <uid>` | Delete a message. On Gmail this moves it to Trash. |
| `move <uid> <mailbox>` | Move a message from the Inbox to another mailbox. |

## Examples

```bash
npx emailcheck init
npx emailcheck list --unread
npx emailcheck read 167 --save-attachments ./att
npx emailcheck label 167 Triaged
npx emailcheck draft-reply 167 --body "Thanks, will take a look."
```

## Configuration

Run `npx emailcheck init` to create a `.env` file in the current directory, or write one yourself:

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
npx emailcheck list --config ~/secrets/mail.env --unread
```

> Gmail requires an **app password**, not your account password. The `.env` file is gitignored — keep it out of version control.

Requires Node >= 22.
