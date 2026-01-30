# Claudex

Your own Claude Code UI. Open source, self-hosted, runs entirely on your machine.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)
[![Python 3.13](https://img.shields.io/badge/python-3.13-blue.svg)](https://www.python.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB.svg)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688.svg)](https://fastapi.tiangolo.com/)
[![Discord](https://img.shields.io/badge/Discord-5865F2.svg?logo=discord&logoColor=white)](https://discord.gg/qVJBdPjr)

## Community

Join our [Discord server](https://discord.gg/qVJBdPjr) to get help, share feedback, and connect with other users.

## Why Claudex?

- **Multiple sandboxes** - Docker (local), E2B (cloud), or Modal (cloud).
- **Use your own plans** - Claude Max, Z.AI Coding, or OpenRouter.
- **Full IDE experience** - VS Code in browser, terminal, file explorer.
- **Extensible** - Skills, agents, slash commands, MCP servers.

## Screenshots

![Chat Interface](screenshots/chat-interface.png)

![Agent Workflow](screenshots/agent-workflow.png)

## Quick Start

```bash
git clone https://github.com/Mng-dev-ai/claudex.git
cd claudex
docker compose up -d
```

Open http://localhost:3000

## Features

### Sandboxed Code Execution
Run AI agents in isolated environments with multiple sandbox providers:
- **Docker** - Fully local, no external dependencies
- **E2B** - Cloud sandboxes with [e2b.dev](https://e2b.dev)
- **Modal** - Serverless cloud sandboxes with [modal.com](https://modal.com)

### Full Development Environment
- VS Code editor in the browser
- Terminal with full PTY support
- File system management
- Port forwarding for web previews
- Environment checkpoints and snapshots

### VNC Browser Control
View and interact with a browser running inside the sandbox via VNC. Use Playwright MCP with Chrome DevTools Protocol (CDP) to let Claude control the browser programmatically.

### Multiple AI Providers
Switch between providers in the same chat:
- **Anthropic** - Use your [Max plan](https://claude.ai/upgrade)
- **OpenAI** - Use your [ChatGPT Pro subscription](https://openai.com/chatgpt/pricing/) (GPT-5.2 Codex, GPT-5.2)
- **OpenRouter** - Access to multiple model providers
- **Custom** - Any Anthropic-compatible API endpoint

### Extend with Skills & Agents
- **Custom Skills** - ZIP packages with YAML metadata
- **Custom Agents** - Define agents with specific tool configurations
- **Slash Commands** - Built-in (`/context`, `/compact`, `/review`, `/init`)
- **MCP Servers** - Model Context Protocol support (NPX, BunX, UVX, HTTP)

### Scheduled Tasks
Automate recurring tasks with Celery workers.

### Chat Features
- Fork chats from any message point
- Restore to any previous message in history
- File attachments with preview

### Preview Capabilities
- Web preview for running applications
- Mobile viewport simulation
- File previews: Markdown, HTML, images, CSV, PDF, PowerPoint

### Marketplace
- Browse and install plugins from official catalog
- One-click installation of agents, skills, commands, MCPs

### Secrets Management
- Environment variables for sandbox execution

### Integrations
- **Gmail** - Read, send, and manage emails via [Gmail MCP Server](https://github.com/GongRzhe/Gmail-MCP-Server)

#### Gmail Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project and enable the Gmail API
3. Create OAuth credentials (Desktop app for localhost, Web application for hosted URLs)
4. If using Web application, add redirect URI: `https://YOUR_DOMAIN/api/v1/integrations/gmail/callback`
5. Download the JSON credentials file
6. In Claudex Settings → Integrations, upload your credentials file
7. Click Connect Gmail to authorize

### Custom Instructions
- System prompts for global context
- Custom instructions injected with each message

## Configuration

Configure providers in Settings → Providers after login.

All providers use Claude Code under the hood. Non-Anthropic providers work through [Anthropic Bridge](https://github.com/Mng-dev-ai/anthropic-bridge), which translates Anthropic API calls to other providers.

```
┌─────────────┐     ┌───────────────────┐     ┌───────────────────────┐
│   Claudex   │────▶│  Anthropic Bridge │────▶│  OpenAI / OpenRouter  │
│             │     │  (API Translator) │     │  / Custom             │
└─────────────┘     └───────────────────┘     └───────────────────────┘
```

This means all providers share the same conversation history stored in `~/.claude` JSONL files, plus the same slash commands, skills, agents, and MCP servers. You can develop a feature with Claude, then switch to GPT-5.2 Codex for review—it already has the full context without needing to re-read files.

### Supported Providers

| Provider | Auth Method | Models |
|----------|-------------|--------|
| Anthropic | OAuth token from `claude setup-token` | Sonnet 4.5, Opus 4.5, Haiku 4.5 |
| OpenAI | Auth file from `codex login` | GPT-5.2 Codex, GPT-5.2 |
| OpenRouter | API key | Multiple providers |
| Custom | API key | Any Anthropic-compatible endpoint |

### OpenAI Setup (ChatGPT Pro)

Use OpenAI models with your ChatGPT Pro subscription:

1. Install [Codex CLI](https://github.com/openai/codex)
2. Run `codex login` and authenticate with your ChatGPT account
3. In Claudex Settings → Providers, add an OpenAI provider
4. Upload your `~/.codex/auth.json` file

### Custom Providers

Use any Anthropic-compatible API endpoint:

1. Get your API key from your provider
2. In Claudex Settings → Providers, add a Custom provider
3. Enter your API endpoint URL and API key

Compatible coding plans:
- [GLM Coding Plan](https://z.ai/subscribe)
- [Kimi Coding Plan](https://www.kimi.com/code)
- [MiniMax Coding Plan](https://platform.minimax.io/subscribe/coding-plan)

You only need one AI provider configured.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│   FastAPI       │────▶│   PostgreSQL    │
│   React/Vite    │     │   Backend       │     │   Database      │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
            ┌───────────┐ ┌───────────┐ ┌─────────────────┐
            │   Redis   │ │  Celery   │ │ Docker Sandbox  │
            │  Pub/Sub  │ │  Workers  │ │                 │
            └───────────┘ └───────────┘ └─────────────────┘
```

## Tech Stack

**Frontend:** React 19, TypeScript, Vite, TailwindCSS, Zustand, React Query, Monaco Editor, XTerm.js

**Backend:** FastAPI, Python 3.13, SQLAlchemy 2.0, Celery, Redis, Granian

## Services

| Service | Port |
|---------|------|
| Frontend | 3000 |
| Backend API | 8080 |
| PostgreSQL | 5432 |
| Redis | 6379 |

## Commands

```bash
docker compose up -d      # Start
docker compose down       # Stop
docker compose logs -f    # Logs
```

## Deployment

For production deployment on a VPS, see the [Coolify Installation Guide](docs/coolify-installation-guide.md).

## API & Admin

- **API Docs:** http://localhost:8080/api/v1/docs
- **Admin Panel:** http://localhost:8080/admin

Default admin: `admin@example.com` / `admin123`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Open a Pull Request

## License

Apache 2.0 - see [LICENSE](LICENSE)
