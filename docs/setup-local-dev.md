## Development Environment

### Local Setup Requirements

1. **Prerequisites**:
    - Orbstack for container management
    - Bun for JavaScript runtime and package management
    - Bruno for API testing
    - DrizzleKit for database management

2. **Environment Configuration**:
   ```bash
   # Required environment variables
   DATABASE_URL="postgresql://user:password@localhost:5432/betternewsdb"
   ```

3. **Database Setup**:
   ```bash
   # Start database container
   orbstack start
   
   # Push schema changes
   bunx drizzle-kit push
   ```

### Development Workflow

1. **Starting the Development Server**:
   ```bash
   bun run dev
   ```

2. **Database Management**:
   ```bash
   # View database schema
   bunx drizzle-kit studio
   ```

3. **API Testing**:
   Use Bruno to test API endpoints with pre-configured collections.

## Troubleshooting Guide

### Common Issues

1. **Database Connection Issues**:
   ```bash
   # Check database container
   orbstack ps
   
   # Verify database connection
   bunx drizzle-kit check
   ```

2. **Schema Sync Issues**:
   ```bash
   # Reset and recreate schema
   bunx drizzle-kit push:fresh
   ```

3. **Authentication Issues**:
    - Check session cookie configuration
    - Verify database connectivity
    - Check password hashing

### Debugging Tools

1. **Database Debugging**:
   ```typescript
   // Enable SQL debugging
   const queryClient = postgres(processEnv.DATABASE_URL, { 
     debug: true 
   });
   ```

2. **API Testing**:
    - Use Bruno collections for endpoint testing
    - Monitor network requests
    - Check response headers

3. **Error Handling**:
   ```typescript
   app.onError((err, c) => {
     if (err instanceof HTTPException) {
       return c.json<ErrorResponse>({
         success: false,
         error: err.message,
         isFormError: err.cause?.form === true
       }, err.status);
     }
     // Log internal errors
     console.error(err);
     return c.json<ErrorResponse>({
       success: false,
       error: process.env.NODE_ENV === "production"
         ? "Internal server error"
         : err.stack ?? err.message
     }, 500);
   });
   ```