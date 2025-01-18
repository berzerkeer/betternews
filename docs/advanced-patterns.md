# Advanced Context and Middleware Patterns in BetterNews

## Advanced Middleware Patterns

Understanding advanced middleware patterns helps us create more maintainable and flexible applications. Let's explore several sophisticated patterns that solve common challenges.

### Composable Middleware Pattern

This pattern allows us to build complex middleware by combining simpler ones. Here's how we can implement it:

```typescript
// A type-safe middleware composer
const composeMiddleware = <T extends Env>(...middlewares: MiddlewareHandler<T>[]) => {
  return createMiddleware<T>(async (c, next) => {
    const executeMiddleware = async (index: number): Promise<void> => {
      if (index === middlewares.length) {
        return next();
      }
      
      await middlewares[index](c, () => executeMiddleware(index + 1));
    };
    
    await executeMiddleware(0);
  });
};

// Example usage
const apiMiddleware = composeMiddleware(
  rateLimitMiddleware,
  authMiddleware,
  loggingMiddleware
);
```

### Conditional Middleware Pattern

Sometimes we need middleware that behaves differently based on conditions:

```typescript
const conditionalAuth = (predicate: (c: Context) => boolean) => {
  return createMiddleware<Context>(async (c, next) => {
    if (predicate(c)) {
      // Apply authentication
      const user = c.get("user");
      if (!user) {
        throw new HTTPException(401, { message: "Authentication required" });
      }
    }
    
    await next();
  });
};

// Usage example
app.get("/posts/:id", 
  conditionalAuth(c => c.req.query("access") === "private"),
  async (c) => {
    // Handle request
  }
);
```

### Error Boundary Middleware

Creating error boundaries helps manage errors at different levels:

```typescript
const errorBoundary = (handler: (error: Error, c: Context) => Response) => {
  return createMiddleware<Context>(async (c, next) => {
    try {
      await next();
    } catch (error) {
      return handler(error as Error, c);
    }
  });
};

// Usage with different error handlers
const apiErrorHandler = errorBoundary((error, c) => {
  if (error instanceof HTTPException) {
    return c.json({
      error: error.message,
      code: error.status
    }, error.status);
  }
  
  // Log unexpected errors
  console.error("Unexpected error:", error);
  return c.json({
    error: "Internal server error",
    code: 500
  }, 500);
});
```

## Custom Context Extensions

Let's explore how to extend the context with custom functionality while maintaining type safety.

### Enhanced User Context

First, let's create a richer user context that includes additional user-related data:

```typescript
interface UserPreferences {
  theme: 'light' | 'dark';
  emailNotifications: boolean;
  timezone: string;
}

interface EnhancedUser extends User {
  preferences: UserPreferences;
  lastActive: Date;
  roles: string[];
}

interface EnhancedContext extends Context {
  Variables: {
    user: EnhancedUser | null;
    session: Session | null;
  };
}

// Middleware to enhance user context
const withEnhancedUser = createMiddleware<EnhancedContext>(async (c, next) => {
  const basicUser = c.get("user");
  
  if (basicUser) {
    // Fetch additional user data
    const [preferences, roles] = await Promise.all([
      getUserPreferences(basicUser.id),
      getUserRoles(basicUser.id)
    ]);
    
    // Create enhanced user object
    const enhancedUser: EnhancedUser = {
      ...basicUser,
      preferences,
      lastActive: new Date(),
      roles
    };
    
    // Update context with enhanced user
    c.set("user", enhancedUser);
  }
  
  await next();
});
```

### Request Context Enhancement

Let's add useful request-specific information to our context:

```typescript
interface RequestMetadata {
  startTime: number;
  clientIp: string;
  userAgent: string;
  requestId: string;
}

interface RequestContext extends Context {
  Variables: {
    metadata: RequestMetadata;
  };
}

const withRequestMetadata = createMiddleware<RequestContext>(async (c, next) => {
  const metadata: RequestMetadata = {
    startTime: Date.now(),
    clientIp: c.req.header("x-forwarded-for") || c.req.ip,
    userAgent: c.req.header("user-agent") || "unknown",
    requestId: crypto.randomUUID()
  };
  
  c.set("metadata", metadata);
  
  // Add useful headers
  c.header("X-Request-ID", metadata.requestId);
  
  await next();
});
```

## Session Management Strategies

### Advanced Session Management

Let's implement a sophisticated session management system:

```typescript
interface SessionManager {
  create: (userId: string, metadata: Record<string, any>) => Promise<string>;
  validate: (sessionId: string) => Promise<Session | null>;
  refresh: (sessionId: string) => Promise<Session>;
  invalidate: (sessionId: string) => Promise<void>;
  getAllUserSessions: (userId: string) => Promise<Session[]>;
}

class RedisSessionManager implements SessionManager {
  private redis: Redis;
  
  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }
  
  async create(userId: string, metadata: Record<string, any>): Promise<string> {
    const sessionId = crypto.randomUUID();
    const session = {
      id: sessionId,
      userId,
      metadata,
      createdAt: new Date(),
      lastAccessed: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };
    
    await this.redis.setex(
      `session:${sessionId}`,
      24 * 60 * 60, // 24 hours in seconds
      JSON.stringify(session)
    );
    
    return sessionId;
  }
  
  async validate(sessionId: string): Promise<Session | null> {
    const sessionData = await this.redis.get(`session:${sessionId}`);
    if (!sessionData) return null;
    
    const session = JSON.parse(sessionData);
    if (new Date(session.expiresAt) < new Date()) {
      await this.invalidate(sessionId);
      return null;
    }
    
    // Update last accessed time
    session.lastAccessed = new Date();
    await this.redis.setex(
      `session:${sessionId}`,
      24 * 60 * 60,
      JSON.stringify(session)
    );
    
    return session;
  }
  
  async refresh(sessionId: string): Promise<Session> {
    const session = await this.validate(sessionId);
    if (!session) {
      throw new Error("Invalid session");
    }
    
    // Extend expiration
    session.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.redis.setex(
      `session:${sessionId}`,
      24 * 60 * 60,
      JSON.stringify(session)
    );
    
    return session;
  }
  
  async invalidate(sessionId: string): Promise<void> {
    await this.redis.del(`session:${sessionId}`);
  }
  
  async getAllUserSessions(userId: string): Promise<Session[]> {
    const keys = await this.redis.keys(`session:*`);
    const sessions = await Promise.all(
      keys.map(async key => {
        const data = await this.redis.get(key);
        return data ? JSON.parse(data) : null;
      })
    );
    
    return sessions.filter(
      session => session && session.userId === userId
    );
  }
}
```

### Session Middleware Integration

Let's integrate our session management with middleware:

```typescript
const withSession = (sessionManager: SessionManager) => {
  return createMiddleware<Context>(async (c, next) => {
    const sessionId = c.req.cookie("session");
    
    if (sessionId) {
      const session = await sessionManager.validate(sessionId);
      if (session) {
        c.set("session", session);
        
        // Refresh session if close to expiration
        const expiresAt = new Date(session.expiresAt);
        if (expiresAt.getTime() - Date.now() < 12 * 60 * 60 * 1000) {
          const refreshed = await sessionManager.refresh(sessionId);
          c.header("Set-Cookie", `session=${refreshed.id}; Path=/; HttpOnly`);
        }
      }
    }
    
    await next();
  });
};
```

## Error Handling Patterns

### Structured Error Handling

Let's implement a comprehensive error handling system:

```typescript
// Define error types
class AppError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

class AuthenticationError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 401, "AUTHENTICATION_ERROR", details);
  }
}

class AuthorizationError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 403, "AUTHORIZATION_ERROR", details);
  }
}

// Error handler middleware
const errorHandler = createMiddleware<Context>(async (c, next) => {
  try {
    await next();
  } catch (error) {
    if (error instanceof AppError) {
      return c.json({
        success: false,
        error: {
          message: error.message,
          code: error.code,
          details: error.details
        }
      }, error.status);
    }
    
    // Log unexpected errors
    console.error("Unexpected error:", error);
    
    return c.json({
      success: false,
      error: {
        message: "Internal server error",
        code: "INTERNAL_ERROR"
      }
    }, 500);
  }
});

// Usage in routes
app.post("/posts", async (c) => {
  const user = c.get("user");
  if (!user) {
    throw new AuthenticationError("Authentication required");
  }
  
  const data = await c.req.json();
  if (!data.title) {
    throw new ValidationError("Title is required", {
      field: "title"
    });
  }
  
  // Process request...
});
```

### Error Recovery Patterns

Let's implement patterns for recovering from errors:

```typescript
interface RetryOptions {
  maxAttempts: number;
  delay: number;
  backoff?: number;
}

const withRetry = <T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<T> => {
  return new Promise(async (resolve, reject) => {
    let attempts = 0;
    let currentDelay = options.delay;
    
    while (attempts < options.maxAttempts) {
      try {
        const result = await operation();
        return resolve(result);
      } catch (error) {
        attempts++;
        
        if (attempts === options.maxAttempts) {
          return reject(error);
        }
        
        // Wait before next attempt
        await new Promise(r => setTimeout(r, currentDelay));
        
        // Apply backoff if specified
        if (options.backoff) {
          currentDelay *= options.backoff;
        }
      }
    }
  });
};

// Usage example
const createPost = async (data: any) => {
  return withRetry(
    async () => {
      const result = await db.insert(postsTable).values(data);
      return result;
    },
    {
      maxAttempts: 3,
      delay: 1000,
      backoff: 2
    }
  );
};
```

## Security Considerations

### Request Validation

Let's implement comprehensive request validation:

```typescript
interface ValidationRule<T> {
  validate: (value: T) => boolean | Promise<boolean>;
  message: string;
}

class RequestValidator<T extends Record<string, any>> {
  private rules: Map<keyof T, ValidationRule<T[keyof T]>[]> = new Map();
  
  addRule<K extends keyof T>(
    field: K,
    rule: ValidationRule<T[K]>
  ) {
    if (!this.rules.has(field)) {
      this.rules.set(field, []);
    }
    this.rules.get(field)!.push(rule as ValidationRule<T[keyof T]>);
  }
  
  async validate(data: T): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    
    for (const [field, rules] of this.rules.entries()) {
      const value = data[field];
      
      for (const rule of rules) {
        const isValid = await rule.validate(value);
        if (!isValid) {
          errors.push(new ValidationError(rule.message, {
            field: field.toString(),
            value
          }));
        }
      }
    }
    
    return errors;
  }
}

// Example usage
interface CreatePostRequest {
  title: string;
  content: string;
  tags: string[];
}

const createPostValidator = new RequestValidator<CreatePostRequest>();

createPostValidator.addRule("title", {
  validate: (value) => typeof value === "string" && value.length >= 3,
  message: "Title must be at least 3 characters"
});

createPostValidator.addRule("content", {
  validate: (value) => typeof value === "string" && value.length >= 10,
  message: "Content must be at least 10 characters"
});

createPostValidator.addRule("tags", {
  validate: (value) => Array.isArray(value) && value.length <= 5,
  message: "Maximum 5 tags allowed"
});

// Use in route handler
app.post("/posts", async (c) => {
  const data = await c.req.json();
  const errors = await createPostValidator.validate(data);
  
  if (errors.length > 0) {
    throw new ValidationError("Invalid request", {
      errors: errors.map(e => ({
        field: e.details?.field,
        message: e.message
      }))
    });
  }
  
  // Process valid request...
});
```

### Request Sanitization

Let's implement a comprehensive input sanitization system to protect against injection attacks:

```typescript
class InputSanitizer {
  // HTML sanitization rules
  private htmlRules = {
    allowedTags: ['p', 'b', 'i', 'em', 'strong', 'a', 'ul', 'li'],
    allowedAttributes: {
      'a': ['href']
    }
  };

  // SQL injection prevention
  sanitizeSqlInput(value: string): string {
    // Remove common SQL injection patterns
    return value.replace(/['";]/g, '');
  }

  // XSS prevention
  sanitizeHtml(content: string): string {
    const clean = DOMPurify.sanitize(content, this.htmlRules);
    return clean;
  }

  // General text sanitization
  sanitizeText(text: string): string {
    return text
      .trim()
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/&/g, '&amp;') // Escape ampersands
      .replace(/"/g, '&quot;') // Escape quotes
      .replace(/'/g, '&#x27;'); // Escape single quotes
  }

  // URL sanitization
  sanitizeUrl(url: string): string | null {
    try {
      const parsed = new URL(url);
      // Only allow http and https protocols
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return null;
      }
      return parsed.toString();
    } catch {
      return null;
    }
  }
}

// Middleware for automatic request sanitization
const sanitizationMiddleware = createMiddleware<Context>(async (c, next) => {
  const sanitizer = new InputSanitizer();

  // Sanitize query parameters
  const query = c.req.query();
  const sanitizedQuery: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(query)) {
    sanitizedQuery[key] = sanitizer.sanitizeText(value);
  }
  
  // Attach sanitized data to context
  c.set('sanitizedQuery', sanitizedQuery);

  // If JSON body, sanitize it
  if (c.req.header('content-type')?.includes('application/json')) {
    const body = await c.req.json();
    const sanitizedBody = sanitizeObject(body, sanitizer);
    c.set('sanitizedBody', sanitizedBody);
  }

  await next();
});

// Helper function to recursively sanitize objects
function sanitizeObject(obj: any, sanitizer: InputSanitizer): any {
  if (typeof obj !== 'object' || obj === null) {
    return typeof obj === 'string' ? sanitizer.sanitizeText(obj) : obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, sanitizer));
  }

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = sanitizeObject(value, sanitizer);
  }
  return result;
}
```

## Activity Monitoring and Logging

Let's implement a comprehensive activity monitoring system:

```typescript
interface ActivityLog {
  id: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata: Record<string, any>;
  timestamp: Date;
  ip: string;
  userAgent: string;
}

class ActivityMonitor {
  private queue: ActivityLog[] = [];
  private batchSize: number;
  private flushInterval: number;
  
  constructor(batchSize = 100, flushInterval = 5000) {
    this.batchSize = batchSize;
    this.flushInterval = flushInterval;
    
    // Start periodic flush
    setInterval(() => this.flush(), flushInterval);
  }
  
  async logActivity(activity: Omit<ActivityLog, 'id' | 'timestamp'>) {
    const log: ActivityLog = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      ...activity
    };
    
    this.queue.push(log);
    
    if (this.queue.length >= this.batchSize) {
      await this.flush();
    }
  }
  
  private async flush() {
    if (this.queue.length === 0) return;
    
    const batch = this.queue.splice(0, this.batchSize);
    
    try {
      await db.insert(activityLogsTable).values(batch);
    } catch (error) {
      console.error('Failed to flush activity logs:', error);
      // Re-add failed logs to the queue
      this.queue.unshift(...batch);
    }
  }
}

// Middleware for automatic activity logging
const activityLogging = (monitor: ActivityMonitor) => {
  return createMiddleware<Context>(async (c, next) => {
    const startTime = Date.now();
    const user = c.get('user');
    
    // Wait for the request to complete
    await next();
    
    // Log the activity
    await monitor.logActivity({
      userId: user?.id,
      action: c.req.method,
      resource: c.req.path,
      metadata: {
        duration: Date.now() - startTime,
        statusCode: c.res.status,
        query: c.req.query()
      },
      ip: c.req.header('x-forwarded-for') || c.req.ip,
      userAgent: c.req.header('user-agent') || 'unknown'
    });
  });
};
```

## Performance Monitoring

Let's implement a performance monitoring system:

```typescript
interface PerformanceMetric {
  name: string;
  value: number;
  labels: Record<string, string>;
  timestamp: Date;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private gauges: Map<string, number> = new Map();
  private counters: Map<string, number> = new Map();
  
  // Record a timing metric
  recordTiming(name: string, duration: number, labels: Record<string, string> = {}) {
    this.metrics.push({
      name,
      value: duration,
      labels,
      timestamp: new Date()
    });
  }
  
  // Update a gauge value
  setGauge(name: string, value: number) {
    this.gauges.set(name, value);
  }
  
  // Increment a counter
  incrementCounter(name: string, increment: number = 1) {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + increment);
  }
  
  // Get performance stats
  getStats() {
    const stats: Record<string, any> = {
      gauges: Object.fromEntries(this.gauges),
      counters: Object.fromEntries(this.counters),
      timings: {}
    };
    
    // Calculate timing statistics
    const groupedMetrics = new Map<string, number[]>();
    for (const metric of this.metrics) {
      if (!groupedMetrics.has(metric.name)) {
        groupedMetrics.set(metric.name, []);
      }
      groupedMetrics.get(metric.name)!.push(metric.value);
    }
    
    for (const [name, values] of groupedMetrics.entries()) {
      stats.timings[name] = {
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        count: values.length
      };
    }
    
    return stats;
  }
}

// Middleware for performance monitoring
const performanceMonitoring = (monitor: PerformanceMonitor) => {
  return createMiddleware<Context>(async (c, next) => {
    const startTime = process.hrtime();
    
    try {
      await next();
    } finally {
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds * 1000 + nanoseconds / 1e6;
      
      monitor.recordTiming('request_duration', duration, {
        path: c.req.path,
        method: c.req.method,
        status: c.res.status.toString()
      });
      
      monitor.incrementCounter('request_count');
    }
  });
};
```

These implementations provide robust foundations for security, monitoring, and performance tracking in your application. The security measures help protect against common web vulnerabilities, while the monitoring systems give you visibility into your application's behavior and performance.

Some key points to remember:

1. Input sanitization should be applied consistently across all user inputs
2. Activity logging helps with debugging and audit trails
3. Performance monitoring helps identify bottlenecks and areas for optimization
4. Consider implementing alerting based on these monitoring systems
5. Regular review of logs and metrics helps maintain application health

When implementing these systems, consider:

1. Storage requirements for logs and metrics
2. Performance impact of monitoring
3. Privacy implications of logged data
4. Retention policies for sensitive information
5. Scalability of the monitoring systems

## Load Balancing Strategies

Let's implement sophisticated load balancing patterns:

```typescript
interface ServiceNode {
  id: string;
  url: string;
  health: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastCheck: Date;
  };
  load: number;
  priority: number;
}

class LoadBalancer {
  private nodes: Map<string, ServiceNode> = new Map();
  private strategy: 'round-robin' | 'least-connections' | 'weighted';
  private currentIndex: number = 0;
  
  constructor(strategy: 'round-robin' | 'least-connections' | 'weighted' = 'round-robin') {
    this.strategy = strategy;
  }
  
  // Register a new service node
  registerNode(node: Omit<ServiceNode, 'health' | 'load'>) {
    this.nodes.set(node.id, {
      ...node,
      health: {
        status: 'healthy',
        lastCheck: new Date()
      },
      load: 0
    });
  }
  
  // Remove a service node
  removeNode(nodeId: string) {
    this.nodes.delete(nodeId);
  }
  
  // Get next node based on strategy
  async getNextNode(): Promise<ServiceNode | null> {
    const availableNodes = Array.from(this.nodes.values())
      .filter(node => node.health.status === 'healthy');
    
    if (availableNodes.length === 0) {
      return null;
    }
    
    switch (this.strategy) {
      case 'round-robin':
        return this.getRoundRobinNode(availableNodes);
      
      case 'least-connections':
        return this.getLeastConnectionsNode(availableNodes);
      
      case 'weighted':
        return this.getWeightedNode(availableNodes);
      
      default:
        return availableNodes[0];
    }
  }
  
  private getRoundRobinNode(nodes: ServiceNode[]): ServiceNode {
    const node = nodes[this.currentIndex % nodes.length];
    this.currentIndex++;
    return node;
  }
  
  private getLeastConnectionsNode(nodes: ServiceNode[]): ServiceNode {
    return nodes.reduce((min, node) => 
      node.load < min.load ? node : min
    );
  }
  
  private getWeightedNode(nodes: ServiceNode[]): ServiceNode {
    const totalPriority = nodes.reduce((sum, node) => 
      sum + node.priority, 0
    );
    
    let random = Math.random() * totalPriority;
    
    for (const node of nodes) {
      random -= node.priority;
      if (random <= 0) {
        return node;
      }
    }
    
    return nodes[nodes.length - 1];
  }
  
  // Update node health status
  updateNodeHealth(nodeId: string, status: ServiceNode['health']['status']) {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.health = {
        status,
        lastCheck: new Date()
      };
    }
  }
  
  // Update node load
  updateNodeLoad(nodeId: string, load: number) {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.load = load;
    }
  }
}

// Middleware for load balancing
const loadBalancingMiddleware = (loadBalancer: LoadBalancer) => {
  return createMiddleware<Context>(async (c, next) => {
    const node = await loadBalancer.getNextNode();
    
    if (!node) {
      throw new Error('No healthy nodes available');
    }
    
    // Store selected node in context
    c.set('serviceNode', node);
    
    try {
      // Increment node load
      loadBalancer.updateNodeLoad(node.id, node.load + 1);
      
      await next();
      
      // Decrement node load
      loadBalancer.updateNodeLoad(node.id, node.load - 1);
    } catch (error) {
      // Decrement node load on error
      loadBalancer.updateNodeLoad(node.id, node.load - 1);
      throw error;
    }
  });
};
```

## Health Monitoring

Let's implement a comprehensive health monitoring system:

```typescript
interface HealthCheck {
  name: string;
  check: () => Promise<boolean>;
  timeout: number;
  interval: number;
  dependencies?: string[];
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  details: Record<string, {
    status: 'healthy' | 'unhealthy';
    lastCheck: Date;
    error?: string;
  }>;
  timestamp: Date;
}

class HealthMonitor {
  private checks: Map<string, HealthCheck> = new Map();
  private status: HealthStatus = {
    status: 'healthy',
    details: {},
    timestamp: new Date()
  };
  
  // Register a health check
  registerCheck(name: string, check: HealthCheck) {
    this.checks.set(name, check);
    
    // Start periodic health check
    setInterval(async () => {
      await this.runCheck(name);
    }, check.interval);
  }
  
  // Run a specific health check
  private async runCheck(name: string) {
    const check = this.checks.get(name);
    if (!check) return;

    try {
      // Create a promise race between the check and timeout
      const result = await Promise.race([
        check.check(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), check.timeout)
        )
      ]);

      this.status.details[name] = {
        status: result ? 'healthy' : 'unhealthy',
        lastCheck: new Date()
      };
    } catch (error) {
      this.status.details[name] = {
        status: 'unhealthy',
        lastCheck: new Date(),
        error: error.message
      };
    }

    // Update overall status
    this.updateOverallStatus();
  }

  // Update the overall system health status
  private updateOverallStatus() {
    const statuses = Object.values(this.status.details)
      .map(detail => detail.status);
    
    if (statuses.every(status => status === 'healthy')) {
      this.status.status = 'healthy';
    } else if (statuses.every(status => status === 'unhealthy')) {
      this.status.status = 'unhealthy';
    } else {
      this.status.status = 'degraded';
    }
    
    this.status.timestamp = new Date();
  }

  // Get current health status
  getStatus(): HealthStatus {
    return { ...this.status };
  }

  // Run all health checks immediately
  async checkAll(): Promise<HealthStatus> {
    const checks = Array.from(this.checks.keys());
    await Promise.all(checks.map(name => this.runCheck(name)));
    return this.getStatus();
  }
}

// Example health checks implementation
class HealthChecks {
  // Database health check
  static databaseCheck(): HealthCheck {
    return {
      name: 'database',
      check: async () => {
        try {
          await db.execute(sql`SELECT 1`);
          return true;
        } catch {
          return false;
        }
      },
      timeout: 5000,
      interval: 30000
    };
  }

  // Redis health check
  static redisCheck(redis: Redis): HealthCheck {
    return {
      name: 'redis',
      check: async () => {
        try {
          await redis.ping();
          return true;
        } catch {
          return false;
        }
      },
      timeout: 2000,
      interval: 15000
    };
  }

  // External API health check
  static apiCheck(url: string): HealthCheck {
    return {
      name: 'external-api',
      check: async () => {
        try {
          const response = await fetch(url);
          return response.ok;
        } catch {
          return false;
        }
      },
      timeout: 5000,
      interval: 60000
    };
  }

  // Memory usage check
  static memoryCheck(threshold: number = 90): HealthCheck {
    return {
      name: 'memory',
      check: async () => {
        const used = process.memoryUsage().heapUsed;
        const total = process.memoryUsage().heapTotal;
        const percentage = (used / total) * 100;
        return percentage < threshold;
      },
      timeout: 1000,
      interval: 60000
    };
  }
}

// Health check middleware
const healthCheckMiddleware = (monitor: HealthMonitor) => {
  return createMiddleware<Context>(async (c, next) => {
    if (c.req.path === '/health') {
      const status = monitor.getStatus();
      return c.json(status, status.status === 'healthy' ? 200 : 503);
    }
    
    await next();
  });
};

// Initialize health monitoring
const initializeHealthMonitoring = (app: Hono) => {
  const monitor = new HealthMonitor();
  const redis = new Redis();

  // Register health checks
  monitor.registerCheck('database', HealthChecks.databaseCheck());
  monitor.registerCheck('redis', HealthChecks.redisCheck(redis));
  monitor.registerCheck('memory', HealthChecks.memoryCheck(90));
  monitor.registerCheck('api', HealthChecks.apiCheck('https://api.example.com/health'));

  // Add health check middleware
  app.use('*', healthCheckMiddleware(monitor));

  return monitor;
};
```

## Service Discovery and Registration

Let's implement a service discovery system that works with our health monitoring:

```typescript
interface ServiceDefinition {
  id: string;
  name: string;
  version: string;
  url: string;
  metadata: Record<string, any>;
}

interface RegisteredService extends ServiceDefinition {
  status: 'available' | 'unavailable';
  lastHeartbeat: Date;
}

class ServiceRegistry {
  private services: Map<string, RegisteredService> = new Map();
  private readonly heartbeatTimeout: number;
  
  constructor(heartbeatTimeout: number = 30000) {
    this.heartbeatTimeout = heartbeatTimeout;
    
    // Start cleanup of stale services
    setInterval(() => this.cleanup(), heartbeatTimeout);
  }

  // Register a new service
  register(service: ServiceDefinition): void {
    this.services.set(service.id, {
      ...service,
      status: 'available',
      lastHeartbeat: new Date()
    });
  }

  // Update service heartbeat
  heartbeat(serviceId: string): void {
    const service = this.services.get(serviceId);
    if (service) {
      service.lastHeartbeat = new Date();
      service.status = 'available';
    }
  }

  // Remove a service
  deregister(serviceId: string): void {
    this.services.delete(serviceId);
  }

  // Get all available services
  getServices(): RegisteredService[] {
    return Array.from(this.services.values())
      .filter(service => service.status === 'available');
  }

  // Get service by ID
  getService(serviceId: string): RegisteredService | undefined {
    return this.services.get(serviceId);
  }

  // Cleanup stale services
  private cleanup(): void {
    const now = Date.now();
    for (const [id, service] of this.services.entries()) {
      const timeSinceHeartbeat = now - service.lastHeartbeat.getTime();
      if (timeSinceHeartbeat > this.heartbeatTimeout) {
        service.status = 'unavailable';
      }
    }
  }
}

// Service registration middleware
const serviceRegistrationMiddleware = (
  registry: ServiceRegistry,
  serviceDefinition: ServiceDefinition
) => {
  return createMiddleware<Context>(async (c, next) => {
    // Register service on startup
    registry.register(serviceDefinition);

    // Send heartbeat
    registry.heartbeat(serviceDefinition.id);

    await next();
  });
}
```

## Circuit Breaker Pattern

Let's implement a circuit breaker to handle service failures gracefully:

```typescript
enum CircuitState {
  CLOSED,
  OPEN,
  HALF_OPEN
}

interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenRetries: number;
}

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private lastFailure?: Date;
  private halfOpenSuccesses: number = 0;
  
  constructor(private options: CircuitBreakerOptions) {}

  async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldReset()) {
        this.transitionToHalfOpen();
      } else {
        return this.handleOpenCircuit(fallback);
      }
    }

    try {
      const result = await operation();
      this.handleSuccess();
      return result;
    } catch (error) {
      return this.handleFailure(error, fallback);
    }
  }

  private shouldReset(): boolean {
    if (!this.lastFailure) return false;
    const now = new Date();
    return now.getTime() - this.lastFailure.getTime() > this.options.resetTimeout;
  }

  private transitionToHalfOpen(): void {
    this.state = CircuitState.HALF_OPEN;
    this.halfOpenSuccesses = 0;
  }

  private async handleOpenCircuit<T>(
    fallback?: () => Promise<T>
  ): Promise<T> {
    if (fallback) {
      return fallback();
    }
    throw new Error('Circuit breaker is open');
  }

  private handleSuccess(): void {
    this.failures = 0;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenSuccesses++;
      if (this.halfOpenSuccesses >= this.options.halfOpenRetries) {
        this.state = CircuitState.CLOSED;
      }
    }
  }

  private async handleFailure<T>(
    error: Error,
    fallback?: () => Promise<T>
  ): Promise<T> {
    this.failures++;
    this.lastFailure = new Date();

    if (this.state === CircuitState.HALF_OPEN ||
        this.failures >= this.options.failureThreshold) {
      this.state = CircuitState.OPEN;
    }

    if (fallback) {
      return fallback();
    }
    throw error;
  }

  getState(): CircuitState {
    return this.state;
  }
}

// Circuit breaker middleware
const circuitBreakerMiddleware = (
  breaker: CircuitBreaker,
  fallback?: (c: Context) => Promise<Response>
) => {
  return createMiddleware<Context>(async (c, next) => {
    return breaker.execute(
      () => next(),
      fallback ? () => fallback(c) : undefined
    );
  });
};

// Usage example
const externalApiBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 60000,
  halfOpenRetries: 3
});

app.use('/api/external',
  circuitBreakerMiddleware(
    externalApiBreaker,
    async (c) => c.json({ error: 'Service temporarily unavailable' }, 503)
  )
);
```

These implementations provide robust mechanisms for monitoring service health, managing service discovery, and handling failures gracefully. The combination of health checks, service registry, and circuit breakers helps build a resilient system that can handle various failure scenarios and maintain system stability.

Some key considerations when implementing these patterns:

1. Health Monitoring:
    - Regular health checks should be non-intrusive
    - Timeouts prevent health checks from hanging
    - Overall system health should consider dependencies

2. Service Discovery:
    - Regular heartbeats ensure service availability
    - Cleanup of stale services prevents resource leaks
    - Service metadata helps with routing and load balancing

3. Circuit Breakers:
    - Failure thresholds should be carefully tuned
    - Reset timeouts prevent premature recovery
    - Fallback mechanisms should be meaningful

Remember to adjust these implementations based on your specific needs and scale. Consider factors like:

1. Network latency for distributed systems
2. Resource consumption of health checks
3. Appropriate timeout values for your environment
4. Logging and monitoring of system state
5. Alert mechanisms for critical failures