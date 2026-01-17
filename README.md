# Better Goals Bot

A lightweight Telegram bot for personal tracking of key life areas. Built as an experiment to improve productivity and focus while developing AI-assisted software engineering skills.

## About

This project is a personal experiment in:
- **Productivity tracking** — Focus on what matters most (max 7 life areas)
- **AI-assisted development** — Built entirely with Claude Code and Cursor
- **Modern TypeScript stack** — Grammy, Prisma, and clean architecture

**Philosophy:** Less is more. A simple tool for maintaining focus, not a complex task manager.

## Features

- Track up to 7 key life areas (work, health, learning, etc.)
- Daily progress logging with streak tracking
- Morning digest and evening reminders
- Timezone-aware scheduling
- Generate AI analysis prompts for external LLMs
- Pinned message with current status

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 20 LTS |
| Language | TypeScript 5+ (strict mode) |
| Bot Framework | Grammy 1.21+ with Conversations |
| Database | Prisma 5+ with SQLite |
| Scheduler | node-cron |
| Validation | Zod |
| Logging | Pino |

## Architecture

```
src/
├── bot/
│   ├── conversations/     # Multi-step wizard flows
│   ├── handlers/          # Command handlers
│   ├── keyboards/         # Inline keyboards
│   └── middleware/        # Error handling, logging
├── services/              # Business logic layer
├── scheduler/             # Cron jobs
├── types/                 # TypeScript types
├── config/                # Environment config
└── db/                    # Prisma client
```

## Getting Started

### Prerequisites

- Node.js 20+
- Telegram Bot Token (from [@BotFather](https://t.me/BotFather))

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/better-goals-bot.git
cd better-goals-bot

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your bot token

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Start development server
npm run dev
```

### Environment Variables

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
DATABASE_URL="file:./data/app.db"
NODE_ENV=development
DEFAULT_TIMEZONE=UTC
```

## Deployment

The bot can be deployed to any VPS with Node.js support.

### Requirements

- VPS with 768MB+ RAM (1GB swap recommended)
- Node.js 20 LTS
- PM2 for process management

### Quick Deploy

1. Setup server (install Node.js, PM2, create swap)
2. Create `/var/app/goals-bot/.env` with bot token
3. Build and upload: `npm run build`, then scp `dist/`, `prisma/`, `package.json`
4. On server: `npm ci --omit=dev && npx prisma migrate deploy`
5. Start: `pm2 start dist/index.js --name goals-bot`

## Commands

| Command | Description |
|---------|-------------|
| `/start` | Start bot, show onboarding or main menu |
| `/areas` | Manage focus areas |
| `/progress` | Log daily progress |
| `/summary` | Generate AI analysis prompt |
| `/settings` | Configure reminders and timezone |
| `/help` | Show help message |

## Development

```bash
# Development with hot reload
npm run dev

# Type checking
npm run typecheck

# Build for production
npm run build

# Run production build
npm start
```

## AI-Assisted Development Process

This project was built entirely using AI-assisted development with **Claude Code** and **Cursor**. Here's an overview of the methodology:

### Phase 1: Vision & Planning

Before writing any code, I worked with AI to create comprehensive documentation:

1. **Project Vision** — Defined the core philosophy ("less is more"), target audience, and intentional limitations (max 7 areas, 200 char limit)
2. **Technical Specification** — Formal requirements (FR/NFR), database schema design, API contracts
3. **Development Checklist** — Step-by-step implementation guide with checkpoints

This upfront planning helped the AI understand the project context and make consistent decisions throughout development.

### Phase 2: Iterative Implementation

The development followed a structured approach:

```
Define requirements → AI generates code → Review & refine → Test → Next feature
```

Key practices:
- **Context files** — `CLAUDE.md` with project rules, tech stack, and coding standards
- **Small increments** — One feature at a time, tested before moving on
- **Code review** — Every AI-generated code was reviewed for quality and security
- **Refactoring sessions** — Periodic cleanup with AI assistance

### Phase 3: Deployment & Documentation

AI assisted with:
- Server setup scripts (swap, Node.js, PM2 configuration)
- Automated deployment scripts
- Comprehensive troubleshooting guides
- Security audit (removing secrets from public files)

### Lessons Learned

**What worked well:**
- Detailed upfront documentation saves time during implementation
- AI excels at boilerplate, configuration, and following established patterns
- Iterative approach catches issues early

**What required human oversight:**
- Architecture decisions and trade-offs
- Security considerations (secrets management)
- UX decisions and edge cases
- Final code review for production readiness

### Tools Used

| Tool | Purpose |
|------|---------|
| Claude Code (CLI) | Primary development, code generation, debugging |
| Cursor | IDE integration, inline completions |
| Claude.ai | Planning, documentation, complex discussions |

> **Note:** While AI accelerated development significantly, every line of code was reviewed and tested. AI is a powerful assistant, but human judgment remains essential for production-quality software.

## Contributing

This is a personal project, but feel free to:
- Open issues for bugs or suggestions
- Fork and adapt for your own use
- Share feedback on the architecture

## License

MIT License — feel free to use this code for your own projects.

## Acknowledgments

Built with the help of:
- [Claude Code](https://claude.ai) — AI-powered development
- [Grammy](https://grammy.dev) — Telegram bot framework
- [Prisma](https://prisma.io) — Database toolkit
