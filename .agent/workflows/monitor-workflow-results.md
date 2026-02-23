---
description: Review workflow results and suggest new workflows if issues remain unresolved
---
# Monitor Workflow Results

This meta-workflow acts as a QA layer. After one or more debug workflows have been
executed, it reviews the results, evaluates whether the issue is resolved, and
suggests creation of new workflows or re-execution if gaps remain.

---

## Step 1 — Collect results from previous workflows

Review the output of the most recently executed workflows. These could be:
- `/trace-outbound-message` — hop-by-hop trace results
- `/check-queue-health` — queue depth/DLQ status
- `/debug-outbound-hop` — per-service deep-dive findings
- `/verify-status-loop` — status callback verification
- `/deep-research-issue` — root cause analysis

---

## Step 2 — Evaluate resolution status

For each workflow that was run, assess:

| Workflow | Ran? | Result | Issue Resolved? |
|----------|------|--------|-----------------|
| `/check-queue-health` | ✅/❌ | Summary | ✅/❌/⚠️ |
| `/trace-outbound-message` | ✅/❌ | Summary | ✅/❌/⚠️ |
| `/debug-outbound-hop` | ✅/❌ | Summary | ✅/❌/⚠️ |
| `/verify-status-loop` | ✅/❌ | Summary | ✅/❌/⚠️ |
| `/deep-research-issue` | ✅/❌ | Summary | ✅/❌/⚠️ |

---

## Step 3 — Identify coverage gaps

Ask these questions:
1. **Was the root cause identified?** If not → run `/deep-research-issue`
2. **Was a fix applied?** If yes → verify by re-running the original tracer
3. **Did the fix resolve the symptom?** If not → the diagnosis was wrong, re-investigate
4. **Are there new errors?** If yes → the fix introduced a regression
5. **Is this a new pattern not covered by existing workflows?** If yes → create one

---

## Step 4 — Recommend follow-up actions

Based on the gaps identified:

### If issue is resolved ✅
- Confirm resolution with the user
- If a new debug pattern was discovered, recommend: `/create-workflow`
- Generate a summary report

### If issue persists ❌
- Identify which hop or service still shows errors
- Recommend re-running the targeted workflow with different parameters
- If the existing workflows couldn't diagnose it, suggest creating a new specialized workflow

### If partially resolved ⚠️
- Identify what was fixed and what remains
- Propose a targeted re-run of specific workflows
- Check if the remaining issue is in a different part of the flow

---

## Step 5 — Suggest new workflows if needed

If the debugging session revealed a pattern that no existing workflow covers, invoke `/create-workflow` with:
- The pattern name
- The steps discovered during debugging
- The services and queues involved

Examples of emergent patterns:
- "Meta token expired and needs refresh" → `/refresh-meta-token`
- "Genesys conversation disconnected but mapping still active" → `/cleanup-stale-mappings`
- "Media upload to MinIO failing silently" → `/debug-media-upload`

---

## Step 6 — Final Report

Generate a comprehensive summary:

```markdown
## Debug Session Summary

**Original Issue**: <symptom>
**Resolution Status**: Resolved / Partially Resolved / Unresolved
**Workflows Executed**: <list>
**Root Cause**: <technical explanation>
**Fix Applied**: <description>
**Verification**: <result>
**New Workflows Created**: <list or "None">
**Recommendations**: <follow-up actions>
```
