#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="services"
OUTPUT_FILE="combined-frd.md"
TEMP_FILE="$(mktemp)"

echo "# Combined Functional Requirements Document" > "$TEMP_FILE"
echo "" >> "$TEMP_FILE"
echo "_Generated on $(date -u +"%Y-%m-%d %H:%M:%S UTC")_" >> "$TEMP_FILE"
echo "" >> "$TEMP_FILE"

found_any=false

# Find all *-frd.md files under services/*/docs
while IFS= read -r -d '' file; do
    found_any=true

    # Extract service name (services/<service>/docs/...)
    service_name=$(echo "$file" | awk -F'/' '{print $2}')
    filename=$(basename "$file")

    echo "" >> "$TEMP_FILE"
    echo "--- BEGIN ${service_name}/${filename} ---" >> "$TEMP_FILE"
    echo "" >> "$TEMP_FILE"

    cat "$file" >> "$TEMP_FILE"

    echo "" >> "$TEMP_FILE"
    echo "--- END ${service_name}/${filename} ---" >> "$TEMP_FILE"
    echo "" >> "$TEMP_FILE"

done < <(find "$ROOT_DIR" -type f -path "*/docs/*-frd.md" -print0 | sort -z)

if [ "$found_any" = false ]; then
    echo "❌ No *-frd.md files found under services/*/docs/"
    rm -f "$TEMP_FILE"
    exit 1
fi

mv "$TEMP_FILE" "$OUTPUT_FILE"

echo "✅ Combined FRD written to $OUTPUT_FILE"
