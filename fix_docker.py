import yaml
with open('docker-compose.prod.yml', 'r') as f:
    data = yaml.safe_load(f)

for name, svc in data.get('services', {}).items():
    if 'build' in svc and 'context' in svc['build']:
        context_path = svc['build']['context']
        if context_path.startswith('./services/'):
            svc['build']['dockerfile'] = f"{context_path}/Dockerfile"
            svc['build']['context'] = '.'

with open('docker-compose.prod.yml', 'w') as f:
    yaml.dump(data, f, default_flow_style=False, sort_keys=False)
