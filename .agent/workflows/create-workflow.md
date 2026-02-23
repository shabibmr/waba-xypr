---
description: Dynamically create a new workflow when a repeating debug pattern is identified
---
# Create Workflow (Dynamic Workflow Generator)

This meta-workflow creates new `.agent/workflows/*.md` files when the agent
identifies a repeating debug pattern that isn't covered by existing workflows.

---

## Step 1 — Identify the pattern

Before creating a new workflow, confirm:
1. **Is this pattern repeating?** Has it occurred more than once?
2. **Is it already covered?** Check existing workflows in `.agent/workflows/`:
   ```bash
   ls -la .agent/workflows/
   ```
3. **Is it specific enough?** A workflow should solve one concrete problem, not be a generic catch-all.

---

## Step 2 — Define the workflow metadata

Determine:
- **Slug**: A kebab-case name for the file (e.g., `fix-expired-meta-token`)
- **Description**: One-line description for the frontmatter
- **Trigger condition**: When should an agent invoke this workflow?

---

## Step 3 — Outline the steps

Structure the workflow using this template:

```markdown
---
description: <one-line description>
---
# <Title>

<Brief explanation of what this workflow does and when to use it.>

> **Compose files**: `docker-compose.remote.yml` (app), `docker-compose.infra.yml` (infra)

---

## Step 1 — <First action>
<Commands and what to look for>

## Step 2 — <Second action>
<Commands and what to look for>

## Step N — Summary
<Structured output table>
```

---

## Step 4 — Write the file

Create the file at `.agent/workflows/<slug>.md` using the `write_to_file` tool.

---

## Step 5 — Validate

1. Confirm the file was created:
   ```bash
   cat .agent/workflows/<slug>.md
   ```
2. Verify it appears in the workflow list (agent will auto-discover it)
3. Notify the user: "Created new workflow: `/<slug>` — <description>"

---

## Guidelines for well-crafted workflows

1. Always specify which compose file to use (`docker-compose.remote.yml` or `docker-compose.infra.yml`)
2. Include exact `docker` commands, not just descriptions
3. Include "What to look for" sections after each command
4. End with a structured summary table
5. Include conditional branching: "If X, do Y; if Z, do W"
6. Reference related workflows with slash commands (e.g., "Run `/restart-service`")
7. Keep the scope narrow — one workflow, one problem domain
