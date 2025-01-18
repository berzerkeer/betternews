# Local Development Setup Guide

## Prerequisites

- [Orbstack](https://orbstack.dev/) - Required for local database container
- [Bun](https://bun.sh/) - JavaScript runtime and package manager
- [Bruno](https://www.usebruno.com/) - API testing tool
- [DrizzleKit](https://orm.drizzle.team/) - SQL ORM toolkit

## IDE Settings
- Webstorm shows error for sql tagged template strings even if template string builds a valid SQL so to disable this error
  - Go to Settings | Editor | Language Injections 
  - Uncheck js: SQL tagged string 
  and apply.

Ref: https://intellij-support.jetbrains.com/hc/en-us/community/posts/17021280043538-How-to-fix-statement-expected-got-CURRENT-TIMESTAMP-using-drizzle

## Database Setup

1. Start Orbstack to run the local database container:
   ```bash
   orbstack start
   ```

   > **Note**: The backend services require a running database instance, which is managed through Orbstack

## Package Management

Bun is used as both the runtime environment and package manager. Key commands:

- Update Bun to latest version:
  ```bash
  bun upgrade
  ```

- Update project dependencies:
  ```bash
  bun update
  ```

- Install project dependencies:
  ```bash
  bun install
  ```

## Database Management with DrizzleKit

DrizzleKit provides tools for database schema management and visualization:

- Open DrizzleKit Studio (database UI):
  ```bash
  bunx drizzle-kit studio
  ```

- Push schema changes to database (similar to migrations):
  ```bash
  bunx drizzle-kit push
  ```
  
- Also, if you have deleted the container volume to reset DB or something, you have to run drizzle-kit push again to create the tables,
after you docker compose up and have spun up the local db.

## Development Server

Start the local development server:
```bash
bun run dev
```
## PGSQL Debugging

To debug any PgSQL errors like syntax errors and such:

- Add `debug:true` option to the drizzle postgres client initialization
- Open orbstack and open the logs of the running pg container
- Hit the query / api again and see the statement which is being executed to see debug in detail

## API Testing

Bruno is pre-configured with API collections for testing the backend endpoints. Use the Bruno desktop app to:
1. Load the project collections
2. Test API endpoints
3. Validate responses

## Best Practices

1. Always ensure Orbstack is running before starting the development server
2. Use DrizzleKit Studio to visualize and verify database schema changes
3. Test API endpoints using Bruno collections before implementation
4. Keep Bruno collections updated when adding or modifying endpoints

## Troubleshooting

- If the server fails to start, verify that:
  1. Orbstack is running
  2. Database connection settings are correct
  3. All dependencies are installed (`bun install`)

- For database issues:
  1. Check DrizzleKit Studio for schema validation
  2. Verify schema changes using `drizzle-kit push`