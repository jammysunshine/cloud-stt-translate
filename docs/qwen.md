# Qwen Configuration

## Project Documentation Hierarchy

This project follows a specific documentation hierarchy that must be respected:

1. **Primary Directive**: Follow the guidelines in [`docs/gemini.md`](docs/gemini.md)
2. **Project Goals**: Refer to [`docs/Prompt.md`](docs/Prompt.md) for overall project objectives
3. **Current Implementation**: Review existing codebase in `src/`, `websocket-server.js`, and other files

## Strict Compliance Requirements

As Qwen, I am mandated to strictly adhere to all guidelines, workflows, and requirements specified in `docs/gemini.md`. This includes but is not limited to:

- Following the **Agent Workflow Mandates** in `docs/gemini.md`
- Maintaining **Rigorous and Comprehensive Test Approach** for all changes
- Adhering to **Commit Message Guidelines** 
- Implementing **General Optimization Guidelines**
- Ensuring **SSR Compatibility**
- Following **Branching Strategy** (separate branches for significant changes)
- Ensuring **Self-Review Before Testing**

## Code Quality Standards

All code contributions must meet the high standards outlined in `docs/gemini.md`:

1. **Structured Logging**: Use `winston` for server-side logging and custom `clientLogger` for client-side logging
2. **Centralized Configuration**: Externalize all hardcoded values into environment variables or configuration files
3. **User-Friendly Error Handling**: Replace intrusive alerts with non-blocking UI notifications
4. **Asynchronous Operations**: Avoid synchronous I/O operations in main execution paths
5. **Resource Management**: Ensure proper cleanup of all allocated resources
6. **Code Readability & Maintainability**: Extract complex logic into well-named variables or helper functions

## Testing Requirements

Every significant change must include:

- Unit Tests
- Integration Tests  
- Shell Script Tests (where applicable)
- End-to-End (E2E) Tests (where applicable)
- Performance Tests (where applicable and feasible)
- Security Tests (where applicable and feasible)

All tests must be kept fully up-to-date with code changes.

## Documentation Maintenance

The following files must be automatically reviewed and updated after any significant change:

- `docs/gemini.md` (this file)
- `docs/Prompt.md` (project goals and requirements)
- `README.md` (if it exists)

This ensures all documentation remains current and accurate.