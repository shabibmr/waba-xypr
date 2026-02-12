#!/bin/bash

# WABA-Xypr Documentation Cleanup Script
# This script organizes the repository by moving obsolete files to archive
# and deleting temporary junk files.

echo "🧹 Starting Documentation Cleanup..."

# 1. Create directory structure
mkdir -p docs/archive
mkdir -p docs/diagrams
mkdir -p docs/deployment

# 2. Move Archive-worthy files
echo "📦 Archiving old status reports and logs..."
mv project_status_report.md docs/archive/ 2>/dev/null
mv phase1_walkthru.md docs/archive/ 2>/dev/null
mv services/phase1_walkthru.md docs/archive/ 2>/dev/null
mv Analyzing\ Microservices\ Architecture.md docs/archive/ 2>/dev/null
mv MVP_DEPLOYMENT_STATUS.md docs/archive/ 2>/dev/null
mv moved_scripts_log.txt docs/archive/ 2>/dev/null
mv services/updates_plan.md docs/archive/ 2>/dev/null
mv AGENT_PORTAL_MIGRATION.md docs/archive/ 2>/dev/null
mv pending_tasks.md docs/archive/pending_tasks_old.md 2>/dev/null

# 3. Remove "Dead" or Temporary files
echo "🗑️  Removing temporary and scratchpad files..."
rm temp_openmessaging.html 2>/dev/null
rm temp_openmessaging_apis.html 2>/dev/null
rm services/GEMINI.md 2>/dev/null
rm *copy.md 2>/dev/null
rm services/*/implementation_plan\ copy.md 2>/dev/null

# Remove the confusing root files that are now consolidated in docs/QUICK_START.md
rm READY_TO_START.md 2>/dev/null
rm INFRASTRUCTURE_QUICKSTART.md 2>/dev/null
rm NGROK_SETUP_GUIDE.md 2>/dev/null

# Remove generic "findings" markdown files from service directories
# These were likely AI-generated analysis logs
find services -name "*_findings.md" -type f -delete

# 4. Consolidate TODOs (Optional - verify before running)
# We have generated docs/ROADMAP.md, so we can archive the mvp_todo folder or keep it.
# For now, we will move the entire mvp_todo folder to archive to clean root.
if [ -d "mvp_todo" ]; then
    echo "📦 Moving mvp_todo/ to docs/archive/mvp_todo_legacy..."
    mv mvp_todo docs/archive/mvp_todo_legacy
fi

echo "✨ Cleanup Complete!"
echo "   - Main docs are now in /docs"
echo "   - Old files are in /docs/archive"
echo "   - Root directory is clean."
