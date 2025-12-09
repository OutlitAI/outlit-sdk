# Contributing to Outlit SDK

Thank you for your interest in contributing to the Outlit SDK! This document provides guidelines and instructions for contributing.

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please be respectful and considerate in all interactions.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/outlit-sdk.git
   cd outlit-sdk
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Create a branch** for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### Building

Build all packages:
```bash
npm run build
```

Build a specific package:
```bash
cd packages/core
npm run build
```

### Testing

Run all tests:
```bash
npm run test
```

Run tests for a specific package:
```bash
cd packages/core
npm run test
```

Run tests in watch mode:
```bash
npm run test:watch
```

### Linting and Formatting

Lint code:
```bash
npm run lint
```

Format code:
```bash
npm run format
```

Check formatting:
```bash
npm run format:check
```

### Type Checking

Run TypeScript type checking:
```bash
npm run typecheck
```

## Making Changes

### Code Style

- Follow the existing code style
- Use TypeScript for all code
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions small and focused

### Commit Messages

Write clear, descriptive commit messages:
- Use present tense ("Add feature" not "Added feature")
- Use imperative mood ("Move cursor to..." not "Moves cursor to...")
- Reference issues and pull requests when relevant
- Keep the first line under 72 characters

Example:
```
Add automatic page view tracking to browser SDK

- Implement page view tracking on navigation
- Add configuration options for auto-tracking
- Update tests and documentation

Fixes #123
```

### Adding New Features

1. **Discuss first**: Open an issue to discuss the feature before implementing
2. **Write tests**: Add tests for new functionality
3. **Update docs**: Update README and relevant documentation
4. **Add types**: Ensure full TypeScript support
5. **Follow patterns**: Match existing code patterns and architecture

### Fixing Bugs

1. **Create an issue**: If one doesn't exist, create an issue describing the bug
2. **Write a test**: Add a test that reproduces the bug
3. **Fix the bug**: Implement the fix
4. **Verify**: Ensure the test passes and no other tests break
5. **Document**: Add comments if the fix is non-obvious

## Pull Request Process

1. **Update documentation**: Ensure all documentation is updated
2. **Add tests**: Ensure adequate test coverage
3. **Run all checks**: Ensure tests, linting, and type checking pass
4. **Update CHANGELOG**: Add an entry to the relevant package's CHANGELOG
5. **Create PR**: Submit a pull request with a clear description
6. **Address feedback**: Respond to review comments promptly

### Pull Request Template

```markdown
## Description
Brief description of the changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
Describe the testing you've done

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Linting passes
- [ ] Type checking passes
- [ ] Builds successfully
```

## Project Structure

```
outlit-sdk/
├── packages/
│   ├── core/          # Core SDK functionality
│   │   ├── src/       # Source code
│   │   ├── dist/      # Built output (generated)
│   │   └── package.json
│   ├── browser/       # Browser-specific SDK
│   └── node/          # Node.js SDK
├── turbo.json         # Turbo build configuration
├── tsconfig.json      # Shared TypeScript config
└── package.json       # Root package with workspaces
```

## Release Process

Releases are managed using [Changesets](https://github.com/changesets/changesets):

1. **Create a changeset**:
   ```bash
   npm run changeset
   ```
2. **Commit the changeset**: Include it in your PR
3. **Release** (maintainers only):
   ```bash
   npm run version
   npm run release
   ```

## Questions?

Feel free to:
- Open an issue for questions
- Join our community discussions
- Email us at support@outlit.ai

Thank you for contributing! 🎉
