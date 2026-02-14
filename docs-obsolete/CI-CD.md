# CI/CD Pipeline Documentation

Comprehensive guide to the CI/CD pipeline for the WhatsApp-Genesys Cloud Integration Platform.

## Overview

The project uses **GitHub Actions** for continuous integration and deployment with 5 automated workflows:

1. **CI** - Testing and linting
2. **Docker Build** - Image building and publishing
3. **Security** - Vulnerability scanning and code analysis
4. **Deploy** - Automated deployments
5. **Dependency Updates** - Automated dependency management

## Workflows

### 1. CI Workflow (`.github/workflows/ci.yml`)

**Triggers**:
- Push to `main`, `develop`
- Pull requests to `main`, `develop`
- Manual dispatch

**Jobs**:
- **Lint**: ESLint code quality checks
- **Test Services**: Parallel testing of all 13 services
- **Integration Tests**: Full stack tests with PostgreSQL, Redis, RabbitMQ
- **Build Check**: Docker build verification

**Features**:
- Matrix strategy for parallel service testing
- Code coverage reporting with Codecov
- Test result artifacts
- Caching for faster builds

**Example**:
```bash
# Automatically runs on push
git push origin develop

# Or trigger manually
gh workflow run ci.yml
```

---

### 2. Docker Build Workflow (`.github/workflows/docker-build.yml`)

**Triggers**:
- Push to `main`
- Tags matching `v*.*.*`
- Manual dispatch with service selection

**Jobs**:
- **Prepare**: Generate build matrix and version
- **Build and Push**: Build all services in parallel
- **Summary**: Build status report

**Features**:
- Multi-platform builds (linux/amd64, linux/arm64)
- Automatic versioning from tags/commits
- Push to GitHub Container Registry and Docker Hub
- Trivy vulnerability scanning
- Build caching

**Manual Trigger**:
```bash
# Build all services
gh workflow run docker-build.yml

# Build specific services
gh workflow run docker-build.yml -f services="api-gateway,auth-service"
```

**Image Tags**:
- `latest` - Latest main branch
- `v1.2.3` - Semantic version
- `main-abc123` - Branch and commit SHA

---

### 3. Security Workflow (`.github/workflows/security.yml`)

**Triggers**:
- Push to `main`, `develop`
- Pull requests
- Weekly schedule (Monday)
- Manual dispatch

**Jobs**:
- **Dependency Scan**: npm audit for all services
- **CodeQL Analysis**: Static code analysis
- **Secret Scan**: TruffleHog secret detection
- **Docker Scan**: Trivy image scanning
- **License Check**: License compliance

**Features**:
- Automated security advisories
- SARIF upload to GitHub Security
- Weekly scheduled scans
- License compliance checking

**View Results**:
- GitHub Security tab → Code scanning alerts
- GitHub Security tab → Dependabot alerts

---

### 4. Deploy Workflow (`.github/workflows/deploy.yml`)

**Triggers**:
- Push to `main` → Auto-deploy to staging
- Release published → Deploy to production
- Manual dispatch with environment selection

**Environments**:
1. **Staging**: Auto-deploy from `main`
2. **Production**: Manual approval required

**Jobs**:
- **Deploy Staging**: Automated staging deployment
- **Deploy Production**: Production deployment with approval
- **Rollback**: Automatic rollback on failure

**Features**:
- Pre-deployment backup
- Database migrations
- Health checks
- Smoke tests
- Deployment notifications
- Rollback capability

**Manual Deploy**:
```bash
# Deploy to staging
gh workflow run deploy.yml -f environment=staging

# Deploy to production (requires approval)
gh workflow run deploy.yml -f environment=production
```

---

### 5. Dependency Update Workflow (`.github/workflows/dependency-update.yml`)

**Triggers**:
- Weekly schedule (Monday 9 AM)
- Manual dispatch

**Jobs**:
- **Check Updates**: Check for outdated packages
- **Update Summary**: Report update status

**Features**:
- Automated PR creation
- Security-only updates option
- Test execution before PR
- Service-specific PRs

**Manual Trigger**:
```bash
# All updates
gh workflow run dependency-update.yml

# Security only
gh workflow run dependency-update.yml -f update-type=security-only
```

---

## Dependabot Configuration

**File**: `.github/dependabot.yml`

**Features**:
- Weekly dependency updates
- Separate PRs per service
- Automatic labeling
- Conventional commit messages

**Managed Ecosystems**:
- npm (all 13 services)
- Docker
- GitHub Actions

---

## Required Secrets

Configure these secrets in GitHub repository settings:

### Docker Registry
```
DOCKER_USERNAME=your_docker_username
DOCKER_PASSWORD=your_docker_password
```

### Genesys Cloud (for integration tests)
```
GENESYS_CLIENT_ID=your_client_id
GENESYS_CLIENT_SECRET=your_client_secret
GENESYS_REGION=mypurecloud.com
```

### Meta WhatsApp (for integration tests)
```
META_APP_SECRET=your_app_secret
META_VERIFY_TOKEN=your_verify_token
```

### Deployment (optional)
```
DEPLOY_SSH_KEY=your_private_key
DEPLOY_HOST=your_server_host
DEPLOY_USER=deploy_user
```

### Notifications (optional)
```
SLACK_WEBHOOK_URL=your_slack_webhook
```

**Setting Secrets**:
1. Go to repository Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add name and value
4. Click "Add secret"

---

## Deployment Process

### Staging Deployment

**Automatic** on push to `main`:

```bash
git checkout main
git merge develop
git push origin main
# Workflow automatically deploys to staging
```

### Production Deployment

**Manual** with approval:

1. Create a release:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. Go to GitHub → Releases → Draft a new release
3. Select tag `v1.0.0`
4. Publish release
5. Approve deployment in GitHub Actions

**Or manual dispatch**:
```bash
gh workflow run deploy.yml -f environment=production
```

---

## Monitoring Workflows

### GitHub Actions UI

1. Go to repository → Actions tab
2. View workflow runs
3. Click on run for details
4. Download artifacts

### CLI Monitoring

```bash
# List workflow runs
gh run list

# View specific run
gh run view <run-id>

# Watch run in real-time
gh run watch <run-id>

# Download artifacts
gh run download <run-id>
```

---

## Troubleshooting

### Workflow Fails

**Check logs**:
```bash
gh run view <run-id> --log
```

**Common issues**:
1. **Test failures**: Check test logs, fix tests
2. **Build failures**: Check Dockerfile, dependencies
3. **Security issues**: Review security alerts, update dependencies
4. **Deployment failures**: Check health endpoints, rollback if needed

### Re-run Failed Jobs

```bash
# Re-run failed jobs
gh run rerun <run-id> --failed

# Re-run entire workflow
gh run rerun <run-id>
```

### Debugging Workflows

Add debug logging:
```yaml
- name: Debug
  run: |
    echo "Debug information"
    env
    ls -la
```

Enable debug mode:
```bash
# Set repository secret
ACTIONS_STEP_DEBUG=true
ACTIONS_RUNNER_DEBUG=true
```

---

## Best Practices

### Pull Requests

1. **Always create PR** for changes
2. **Wait for CI** to pass before merging
3. **Review security** scan results
4. **Update tests** for new features

### Deployments

1. **Test in staging** before production
2. **Monitor health** checks after deployment
3. **Keep backups** before production deploy
4. **Document changes** in release notes

### Security

1. **Review Dependabot** PRs weekly
2. **Fix critical** vulnerabilities immediately
3. **Update secrets** regularly
4. **Monitor security** alerts

---

## Adding New Workflows

### 1. Create Workflow File

```yaml
# .github/workflows/my-workflow.yml
name: My Workflow

on:
  push:
    branches: [ main ]

jobs:
  my-job:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run command
        run: echo "Hello World"
```

### 2. Test Workflow

```bash
# Commit and push
git add .github/workflows/my-workflow.yml
git commit -m "feat: add new workflow"
git push

# Trigger manually
gh workflow run my-workflow.yml
```

### 3. Monitor Results

```bash
gh run list --workflow=my-workflow.yml
```

---

## Workflow Optimization

### Caching

```yaml
- name: Cache dependencies
  uses: actions/cache@v4
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
```

### Matrix Strategy

```yaml
strategy:
  matrix:
    node-version: [18, 20]
    os: [ubuntu-latest, windows-latest]
```

### Conditional Execution

```yaml
- name: Deploy
  if: github.ref == 'refs/heads/main'
  run: ./deploy.sh
```

---

## Cost Management

### GitHub Actions Minutes

**Free tier**: 2,000 minutes/month

**Estimated usage**:
- CI: ~200 minutes/month
- Docker builds: ~150 minutes/month
- Security scans: ~100 minutes/month
- Deployments: ~50 minutes/month
- **Total**: ~500 minutes/month

**Optimization tips**:
1. Use caching
2. Limit matrix builds
3. Skip redundant jobs
4. Use self-hosted runners for heavy workloads

---

## Related Documentation

- [Development Guide](DEVELOPMENT.md)
- [Deployment Guide](deployment/refined-setup-guide.md)
- [Troubleshooting Guide](TROUBLESHOOTING.md)
- [Contributing Guidelines](../CONTRIBUTING.md)
