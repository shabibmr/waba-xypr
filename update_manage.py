import os

with open('manage.sh', 'r') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if 'INFRA_ONLY=false' in line:
        new_lines.append(line)
        new_lines.append('TWO_TIER=false\n')
    elif 'case $1 in' in line:
        new_lines.append(line)
        new_lines.append('        --2tier) TWO_TIER=true ;;\n')
    elif 'COMPOSE_REMOTE=' in line:
        new_lines.append(line)
        new_lines.append('COMPOSE_2TIER="-f docker-compose.2tier.yml"\n')
    elif 'get_compose_args() {' in line:
        new_lines.append('get_compose_args() {\n')
        new_lines.append('    if [ "" = true ]; then\n')
        new_lines.append('        echo ""\n')
        new_lines.append('    elif [ "" = true ]; then\n')
        new_lines.append('        echo ""\n')
    elif 'docker compose' in line:
        new_lines.append(line.replace('docker compose', 'sudo docker compose'))
    elif 'docker ps' in line:
        new_lines.append(line.replace('docker ps', 'sudo docker ps'))
    elif 'docker exec' in line:
        new_lines.append(line.replace('docker exec', 'sudo docker exec'))
    else:
        new_lines.append(line)

# Handle the rest of get_compose_args if we didn't finish it
# This script is a bit fragile with exact line matches, let's just rewrite the whole thing for reliability
