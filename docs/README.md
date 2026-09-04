# ShowTracker Documentation

Durable project memory: goals, current architecture, and decisions. No phase logs, handoff notes, or implementation plans live here. Start with `../AGENTS.md`, then pick the smallest doc that matches the task.

| Doc | Purpose |
| --- | --- |
| [GOALS.md](GOALS.md) | Product direction, non-goals, and high-risk guardrails |
| [../CONTEXT.md](../CONTEXT.md) | Product vocabulary and naming rules |
| [DECISIONS.md](DECISIONS.md) | ADR index grouped by behavior area |
| [ARCHITECTURE.md](ARCHITECTURE.md) | App, backend, production runtime, and which layer produces which fact |
| [SCHEDULE_CONFIDENCE.md](SCHEDULE_CONFIDENCE.md) | Release-state reconciler goals, commands, and VPS production commands |

## Decisions

All `ADR-####-*.md` files are retained. They explain why risky behavior exists, especially around watchlist, schedule, release availability, provider matching, duplicate collapse, and Convex I/O. Read [DECISIONS.md](DECISIONS.md) before changing those areas and add a new ADR for any behavior-changing watchlist, schedule, release, provider, or projection work.

Setup, env, and commands: `.env.example` and `package.json`.
