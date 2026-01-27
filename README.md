# deadline-sync

Automatically sync Brightspace course deadlines to Apple Reminders. Supports both automated scraping from Brightspace and manual syllabus parsing.

## Features

- **Brightspace Integration**: Automatically fetches assignments, quizzes, and calendar events from all enrolled courses
- **Semester Filtering**: Only syncs courses from the current semester (Winter, Spring/Summer, Fall)
- **Syllabus Parsing**: Extract dates from syllabus files (PDF, .docx, .doc) with intelligent date detection
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
bun run cli login
```

Opens a browser window for authentication (supports 2FA). Session is saved for 24 hours.

```bash
bun run cli login --status   # Check if session is valid
bun run cli login --clear    # Clear saved session
```

### Sync Deadlines

```bash
bun run cli sync
```

Fetches all deadlines from Brightspace and creates Apple Reminders.

```bash
bun run cli sync --dry-run   # Preview without creating reminders
```

### Check Status

```bash
bun run cli status
```

Shows session validity, total synced reminders, and upcoming deadlines.

```bash
bun run cli status --events  # List all synced deadlines with due dates
```

### Syllabus Parsing

#### Auto-fetch from Brightspace

```bash
bun run cli syllabus fetch
```

Automatically finds and downloads syllabus PDFs from all enrolled courses. Searches for files named "syllabus", "course outline", "course overview", etc.

```bash
bun run cli syllabus fetch --parse           # Download and parse for dates
bun run cli syllabus fetch --parse --dry-run # Preview without creating reminders
```

#### Manual file parsing

```bash
bun run cli syllabus add <file> --course "Course Name"
bun run cli syllabus add <file> --course "Course Name" --dry-run
```

Extracts dates from a syllabus file and interactively creates reminders for each detected deadline.

Supported file types: `.pdf`, `.docx`, `.doc`

Note: Syllabus parsing focuses on non-assignment items (exams, midterms, readings, presentations) since assignments are already captured by Brightspace sync.

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
- `data/syllabi/` - Downloaded syllabus PDFs (cached)
- `data/sync.log` - Application logs

## Requirements

- macOS (for Apple Reminders integration)
- Bun runtime
- Brightspace account
