# Contributing Guidelines

Thank you for considering contributing to the WhatsApp-Genesys Cloud Integration Platform!

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive feedback
- Respect differing viewpoints and experiences

## Getting Started

1. **Fork the repository**
2. **Clone your fork**:
   ```bash
   git clone https://github.com/your-username/whatsapp-genesys-integration.git
   ```
3. **Set up development environment**: See [DEVELOPMENT.md](docs/DEVELOPMENT.md)
4. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## How to Contribute

### Reporting Bugs

**Before submitting a bug report**:
- Check existing issues to avoid duplicates
- Verify the bug exists in the latest version
- Collect relevant information (logs, environment, steps to reproduce)

**Bug Report Template**:
```markdown
## Description
Brief description of the bug

## Steps to Reproduce
1. Step one
2. Step two
3. Step three

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- OS: Windows 11
- Node.js: 20.10.0
- Docker: 24.0.7
- Service: api-gateway

## Logs
```
Paste relevant logs here
```

## Suggesting Features

**Feature Request Template**:
```markdown
## Feature Description
Clear description of the proposed feature

## Use Case
Why is this feature needed? What problem does it solve?

## Proposed Implementation
How might this be implemented?

## Alternatives Considered
What other solutions have you considered?
```

## Pull Request Process

### 1. Before You Start

- Discuss major changes in an issue first
- Check if someone is already working on it
- Review existing code to understand patterns

### 2. Making Changes

#### Code Standards

**JavaScript Style**:
```javascript
// Use const/let, not var
const tenantId = req.tenant.id;
let messageCount = 0;

// Use arrow functions for callbacks
messages.map(msg => transformMessage(msg));

// Use async/await, not callbacks
async function processMessage(message) {
  const result = await sendToGenesys(message);
  return result;
}

// Use template literals
console.log(`Processing message ${messageId} for tenant ${tenantId}`);

// Destructure when appropriate
const { id, name, status } = tenant;
```

**Error Handling**:
```javascript
// Always handle errors
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  console.error('Operation failed:', error.message);
  throw new Error('Failed to process request');
}

// Use specific error messages
if (!tenantId) {
  throw new Error('Tenant ID is required');
}
```

**Logging**:
```javascript
// Include context in logs
console.log(`[${tenantId}] Processing message ${messageId}`);

// Use appropriate log levels
console.error('[ERROR]', error);
console.warn('[WARN]', warning);
console.info('[INFO]', info);
console.log('[DEBUG]', debug);
```

#### File Organization

```javascript
// Order imports: external, shared, local
const express = require('express');
const axios = require('axios');
const { QUEUES } = require('../../shared/constants');
const messageService = require('./services/messageService');

// Group related code
// 1. Constants
// 2. Helper functions
// 3. Main logic
// 4. Exports
```

#### Using Shared Libraries

```javascript
// ✅ DO: Use shared constants
const { QUEUES, SERVICES } = require('../../shared/constants');
await channel.assertQueue(QUEUES.INBOUND_WHATSAPP_MESSAGES);

// ❌ DON'T: Hardcode values
await channel.assertQueue('inbound-messages');

// ✅ DO: Use tenant resolver middleware
const { tenantResolver } = require('../../shared/middleware/tenantResolver');
app.use(tenantResolver);

// ❌ DON'T: Manually parse tenant
const tenantId = req.headers['x-tenant-id'];
```

### 3. Testing Requirements

**All PRs must include tests**:

```javascript
// Unit tests for business logic
describe('MessageTransformer', () => {
  it('should transform WhatsApp message to Genesys format', () => {
    const whatsappMsg = { from: '+919876543210', text: { body: 'Hello' } };
    const genesysMsg = transformer.toGenesys(whatsappMsg);
    
    expect(genesysMsg.channel).toBe('Open');
    expect(genesysMsg.text).toBe('Hello');
  });
});

// API tests for endpoints
describe('GET /health', () => {
  it('should return 200 OK', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
  });
});
```

**Test Coverage**:
- Aim for >80% coverage on new code
- Test happy paths and error cases
- Use mocks for external dependencies

### 4. Documentation Requirements

**Update documentation when**:
- Adding new features
- Changing APIs
- Modifying configuration
- Adding environment variables

**Required documentation**:
- Service README if adding new service
- API documentation for new endpoints
- Code comments for complex logic
- Update CHANGELOG.md

**Documentation Style**:
```markdown
# Clear, descriptive headings

## Use examples

```javascript
// Show how to use the feature
const result = await newFeature(params);
```

## Include tables for structured data

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| tenantId | string | Yes | Tenant identifier |
```

### 5. Commit Guidelines

**Commit Message Format**:
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements

**Examples**:
```
feat(auth): add support for refresh tokens

Implement refresh token endpoint to allow clients to obtain
new access tokens without re-authentication.

Closes #123
```

```
fix(webhook): resolve signature validation issue

WhatsApp signature validation was failing due to incorrect
encoding. Updated to use UTF-8 encoding for HMAC calculation.

Fixes #456
```

### 6. Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Related Issues
Closes #123

## Changes Made
- Added X feature
- Fixed Y bug
- Updated Z documentation

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project conventions
- [ ] Tests pass locally
- [ ] Documentation updated
- [ ] No console.logs in production code
- [ ] Shared constants used where applicable
- [ ] Environment variables documented
```

### 7. Code Review Process

**As a Contributor**:
- Respond to feedback promptly
- Be open to suggestions
- Ask questions if unclear
- Update PR based on feedback

**As a Reviewer**:
- Be constructive and respectful
- Explain reasoning for suggestions
- Approve when requirements are met
- Test changes locally if possible

**Review Checklist**:
- [ ] Code quality and readability
- [ ] Tests adequate and passing
- [ ] Documentation complete
- [ ] No security issues
- [ ] Performance considerations
- [ ] Error handling appropriate
- [ ] Follows project conventions

## Development Workflow

### Branch Naming

```
feature/add-whatsapp-stickers
bugfix/fix-token-refresh
hotfix/critical-security-patch
docs/update-api-documentation
refactor/extract-transformer-logic
```

### Workflow Steps

1. **Create branch** from `develop`
2. **Make changes** following guidelines
3. **Write tests** for new code
4. **Run tests** locally
5. **Update documentation**
6. **Commit changes** with clear messages
7. **Push to fork**
8. **Create Pull Request**
9. **Address review feedback**
10. **Merge** after approval

## Project-Specific Guidelines

### Adding New Services

1. Follow standard service structure
2. Add to `shared/constants/services.js`
3. Create comprehensive README
4. Add Docker configuration
5. Update docker-compose files
6. Add health check endpoint
7. Implement tenant resolution
8. Add to deployment scripts

### Modifying Shared Libraries

1. Discuss changes in issue first (impacts all services)
2. Update all affected services
3. Add migration guide if breaking change
4. Update shared/README.md
5. Notify all service teams

### Database Changes

1. Create migration script
2. Test migration up and down
3. Update models/schemas
4. Add indexes for new queries
5. Document in migration file

## Getting Help

- **Questions**: Open a discussion
- **Bugs**: Create an issue
- **Features**: Propose in an issue first
- **Documentation**: Check docs/ directory
- **Code**: Review existing services for patterns

## Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Credited in commit history

Thank you for contributing! 🎉
