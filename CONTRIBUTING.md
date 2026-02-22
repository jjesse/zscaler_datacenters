# Contributing Guide

Thank you for your interest in contributing to Zscaler Datacenter Lookup!

## Development Setup

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd zscaler_datacenters
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run in development mode**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:3000`.

4. **Run tests**
   ```bash
   npm test
   npm run test:coverage  # with coverage report
   ```

5. **Run linter**
   ```bash
   npm run lint
   ```

## Code Style

- All JavaScript uses `'use strict'` and ES2021 features.
- Use `const` by default; `let` only when reassignment is needed.
- Single quotes for strings.
- ESLint enforces the rules defined in `.eslintrc.js`.

## Project Structure

```
.
├── server.js            # Express backend
├── utils/
│   └── ip.js            # IP utility functions
├── public/
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── tests/
│   ├── unit/
│   └── integration/
└── docker-compose.yml
```

## Pull Request Guidelines

- Open an issue before starting non-trivial work.
- Keep PRs focused on a single change.
- Ensure all tests pass before requesting review.
- Add or update tests for any new functionality.
- Update `CHANGELOG.md` with a summary of your change.

## Running with Docker

```bash
docker-compose up --build
```
