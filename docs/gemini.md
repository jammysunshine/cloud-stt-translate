This is a file created by Gemini.

After every logical step or feature implementation (e.g., after implementing a new function, or fixing a bug, or completing a set of related changes), I will automatically commit and push the changes to the GitHub repository.

For the overall project goals and requirements, refer to `prompt.md`.

---

**Important Note:** This `gemini.md` file, along with `README.md` and `Prompt.md`, must be reviewed and updated automatically after any significant change to the project to ensure all documentation remains current and accurate.

**Code Maintenance:** Regularly review the code for issues, optimizations, and unused parts (imports, variables, functions, dead code) to maintain a clean, efficient, and high-quality codebase. This should be done frequently and automatically if possible.

*   **Structured Logging:** Implemented `winston` for server-side logging and a custom `clientLogger` for client-side logging to improve visibility and management of application events and errors.

---

**Commit Message Guidelines:** Commit messages should be simple, concise, and descriptive. Avoid using special characters (e.g., `!`, `@`, `#`, `$`, `%`, `^`, `&`, `*`, `(`, `)`, `[`, `]`, `{`, `}`, `;`, `:`, `'`, `"`, `<`, `>`, `?`, `/`, `\`, `|`, `~`, `` ` ``, `-`, `_`, `=`, `+`) in the commit message itself to ensure compatibility and readability across various Git tools and platforms.

---

**General Optimization Guidelines:** For all future updates and projects, adhere to the following best practices:

*   **Structured Logging:** Implement a dedicated logging solution (e.g., Winston for server, custom logger for client) with configurable levels. Avoid raw `console.log` in production.
*   **Centralized Configuration:** Externalize all hardcoded values (e.g., API keys, ports, timeouts, language codes, MIME types) into environment variables or a central configuration file.
*   **User-Friendly Error Handling:** Replace intrusive `alert` or raw `console.error` with non-blocking, user-friendly UI notifications (e.g., toast messages, banners) for client-side errors in production.
*   **Asynchronous Operations:** Avoid synchronous I/O operations (e.g., `fs.readFileSync`) in main execution paths. Perform heavy or blocking operations asynchronously, ideally during application startup or initialization.
*   **Resource Management:** Always ensure proper and timely cleanup of all allocated resources (e.g., WebSocket connections, media streams, timers, event listeners) to prevent leaks and unexpected behavior.
*   **Code Readability & Maintainability:** Extract complex conditional logic into well-named variables or helper functions. Refactor repetitive code into reusable functions or components.
