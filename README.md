# deadline-sync

Automatically sync Brightspace course deadlines to Apple Reminders. Supports both automated scraping from Brightspace and manual syllabus PDF parsing.

## Features

- **Brightspace Integration**: Automatically fetches assignments, quizzes, and calendar events from all enrolled courses
- **Semester Filtering**: Only syncs courses from the current semester (Winter, Spring/Summer, Fall)
- **Syllabus Parsing**: Extract dates from PDF syllabi with intelligent date detection
- **Duplicate Prevention**: Tracks synced items to avoid creating duplicate reminders
- **Apple Reminders**: Creates reminders with due dates and advance notifications

## Installation

```bash
bun install
npx playwright install chromium
```

## Usage

### Login to Brightspace

```bash
bun run login
```

Opens a browser window for authentication (supports 2FA). Session is saved for 24 hours.

```bash
bun run login --status   # Check if session is valid
bun run login --clear    # Clear saved session
```

### Sync Deadlines

```bash
bun run sync
```

Fetches all deadlines from Brightspace and creates Apple Reminders.

```bash
bun run sync --dry-run   # Preview without creating reminders
```

### Check Status

```bash
bun run status
```

Shows session validity, total synced reminders, and upcoming deadlines.

```bash
bun run status --events  # List all synced deadlines with due dates
```

### Parse Syllabus PDF

```bash
bun run syllabus add <file.pdf> --course "Course Name"
```

Extracts dates from a syllabus PDF and interactively creates reminders for each detected deadline.

## Configuration

Configuration is in `src/utils/config.ts`:

| Setting | Default | Description |
|---------|---------|-------------|
| `brightspace.baseUrl` | `https://uottawa.brightspace.com` | Brightspace instance URL |
| `reminders.listName` | `School` | Apple Reminders list name |
| `reminders.advanceDays` | `5` | Days before deadline to send reminder |

## Data Storage

All data is stored in the `data/` directory:

- `data/sync.db` - SQLite database tracking synced reminders
- `data/session/` - Authenticated Brightspace session
- `data/sync.log` - Application logs

## Requirements

- macOS (for Apple Reminders integration)
- Bun runtime
- Brightspace account
