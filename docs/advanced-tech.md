# Advanced Technical Concepts in BetterNews

## Advanced Database Optimization Techniques

### Understanding PostgreSQL Query Planning

Let's start by understanding how PostgreSQL processes queries. When you submit a query, PostgreSQL creates an execution plan. Understanding this process helps us write more efficient queries.

```sql
-- Example query to analyze
EXPLAIN ANALYZE
SELECT p.*, u.username 
FROM posts p 
JOIN users u ON p.user_id = u.id 
WHERE p.points > 100 
ORDER BY p.created_at DESC;
```

The query planner considers several factors:
1. Table sizes
2. Index availability
3. Data distribution
4. Join types (nested loop, hash join, merge join)

Let's implement some advanced optimization techniques:

### Materialized Views for Complex Aggregations

When you have expensive calculations that don't need real-time updates, materialized views can help:

```typescript
// First, create the materialized view in PostgreSQL
const createMaterializedView = sql`
  CREATE MATERIALIZED VIEW post_stats AS
  SELECT 
    user_id,
    COUNT(*) as post_count,
    AVG(points) as avg_points,
    MAX(points) as max_points
  FROM posts
  GROUP BY user_id
  WITH DATA;

  CREATE UNIQUE INDEX post_stats_user_id ON post_stats(user_id);
`;

// Function to refresh the materialized view
const refreshPostStats = async () => {
  await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY post_stats`);
};

// Schedule refresh every hour
setInterval(refreshPostStats, 60 * 60 * 1000);
```

### Partial Indexes for Specific Queries

Create indexes that only include relevant rows:

```typescript
// Create partial index for popular posts
const createPartialIndex = sql`
  CREATE INDEX popular_posts_idx 
  ON posts (created_at) 
  WHERE points > 100;
`;

// Query using the partial index
const getPopularPosts = async () => {
  return db
    .select()
    .from(postsTable)
    .where(gt(postsTable.points, 100))
    .orderBy(desc(postsTable.createdAt));
};
```

### Advanced Caching Strategies

Let's implement a multi-level caching system:

```typescript
class MultiLevelCache {
  private memoryCache: Map<string, any>;
  private redis: Redis;

  constructor() {
    this.memoryCache = new Map();
    this.redis = new Redis(process.env.REDIS_URL);
  }

  async get(key: string): Promise<any> {
    // Try memory cache first (L1)
    const memoryResult = this.memoryCache.get(key);
    if (memoryResult) {
      return memoryResult;
    }

    // Try Redis next (L2)
    const redisResult = await this.redis.get(key);
    if (redisResult) {
      // Populate memory cache
      this.memoryCache.set(key, JSON.parse(redisResult));
      return JSON.parse(redisResult);
    }

    return null;
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    // Set in memory cache
    this.memoryCache.set(key, value);

    // Set in Redis with optional TTL
    if (ttl) {
      await this.redis.setex(key, ttl, JSON.stringify(value));
    } else {
      await this.redis.set(key, JSON.stringify(value));
    }
  }

  async invalidate(pattern: string): Promise<void> {
    // Clear memory cache entries matching pattern
    for (const key of this.memoryCache.keys()) {
      if (key.includes(pattern)) {
        this.memoryCache.delete(key);
      }
    }

    // Clear Redis cache entries matching pattern
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
```

### Implementing Intelligent Cache Invalidation

Let's create a smart cache invalidation system that understands data relationships:

```typescript
class CacheInvalidator {
  private dependencyGraph: Map<string, Set<string>>;
  private cache: MultiLevelCache;

  constructor(cache: MultiLevelCache) {
    this.dependencyGraph = new Map();
    this.cache = cache;
  }

  // Register cache dependencies
  addDependency(key: string, dependsOn: string) {
    if (!this.dependencyGraph.has(dependsOn)) {
      this.dependencyGraph.set(dependsOn, new Set());
    }
    this.dependencyGraph.get(dependsOn)!.add(key);
  }

  // Invalidate cache and all dependent keys
  async invalidate(key: string) {
    const keysToInvalidate = new Set([key]);
    const queue = [key];

    // Find all dependent keys
    while (queue.length > 0) {
      const current = queue.shift()!;
      const dependents = this.dependencyGraph.get(current) || new Set();
      
      for (const dependent of dependents) {
        if (!keysToInvalidate.has(dependent)) {
          keysToInvalidate.add(dependent);
          queue.push(dependent);
        }
      }
    }

    // Invalidate all affected keys
    for (const keyToInvalidate of keysToInvalidate) {
      await this.cache.invalidate(keyToInvalidate);
    }
  }
}

// Usage example
const cache = new MultiLevelCache();
const invalidator = new CacheInvalidator(cache);

// Register dependencies
invalidator.addDependency('user:posts:*', 'user:*');
invalidator.addDependency('post:comments:*', 'post:*');

// When updating a user
async function updateUser(userId: string, data: any) {
  await db.update(userTable)
    .set(data)
    .where(eq(userTable.id, userId));
    
  // Invalidate user cache and all dependent caches
  await invalidator.invalidate(`user:${userId}`);
}
```

## Advanced Performance Monitoring

### Implementing Custom Performance Metrics

Let's create a comprehensive monitoring system:

```typescript
interface PerformanceMetric {
  name: string;
  value: number;
  tags: Record<string, string>;
  timestamp: Date;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private alertThresholds: Map<string, number> = new Map();

  // Record a metric
  record(
    name: string,
    value: number,
    tags: Record<string, string> = {}
  ) {
    const metric = {
      name,
      value,
      tags,
      timestamp: new Date()
    };

    this.metrics.push(metric);
    this.checkAlert(metric);
  }

  // Set alert threshold for a metric
  setAlertThreshold(name: string, threshold: number) {
    this.alertThresholds.set(name, threshold);
  }

  // Check if metric exceeds threshold
  private checkAlert(metric: PerformanceMetric) {
    const threshold = this.alertThresholds.get(metric.name);
    if (threshold && metric.value > threshold) {
      this.sendAlert(metric);
    }
  }

  // Send alert (implement your notification system)
  private async sendAlert(metric: PerformanceMetric) {
    console.error(`Alert: ${metric.name} exceeded threshold`);
    // Implement alert notification (email, Slack, etc.)
  }

  // Get metrics for analysis
  getMetrics(options: {
    name?: string;
    tags?: Record<string, string>;
    startTime?: Date;
    endTime?: Date;
  }) {
    return this.metrics.filter(metric => {
      if (options.name && metric.name !== options.name) return false;
      if (options.startTime && metric.timestamp < options.startTime) return false;
      if (options.endTime && metric.timestamp > options.endTime) return false;
      if (options.tags) {
        for (const [key, value] of Object.entries(options.tags)) {
          if (metric.tags[key] !== value) return false;
        }
      }
      return true;
    });
  }

  // Calculate statistics
  calculateStats(metrics: PerformanceMetric[]) {
    const values = metrics.map(m => m.value);
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      p95: this.calculatePercentile(values, 95),
      p99: this.calculatePercentile(values, 99)
    };
  }

  private calculatePercentile(values: number[], percentile: number) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }
}
```

### Implementing Query Performance Monitoring

Let's create a query monitoring system:

```typescript
class QueryMonitor {
  private monitor: PerformanceMonitor;

  constructor(monitor: PerformanceMonitor) {
    this.monitor = monitor;
  }

  // Wrap database queries with monitoring
  async trackQuery<T>(
    name: string,
    queryFn: () => Promise<T>,
    tags: Record<string, string> = {}
  ): Promise<T> {
    const start = process.hrtime();

    try {
      const result = await queryFn();
      const [seconds, nanoseconds] = process.hrtime(start);
      const duration = seconds * 1000 + nanoseconds / 1e6;

      this.monitor.record(`query.${name}`, duration, {
        ...tags,
        status: 'success'
      });

      return result;
    } catch (error) {
      const [seconds, nanoseconds] = process.hrtime(start);
      const duration = seconds * 1000 + nanoseconds / 1e6;

      this.monitor.record(`query.${name}`, duration, {
        ...tags,
        status: 'error',
        error: error.message
      });

      throw error;
    }
  }
}

// Usage example
const monitor = new PerformanceMonitor();
const queryMonitor = new QueryMonitor(monitor);

// Set alert thresholds
monitor.setAlertThreshold('query.getPost', 100); // Alert if query takes more than 100ms

// Use in your database queries
const getPost = async (id: number) => {
  return queryMonitor.trackQuery(
    'getPost',
    () => db.select()
      .from(postsTable)
      .where(eq(postsTable.id, id))
      .limit(1),
    { postId: id.toString() }
  );
};
```

## Scaling Considerations

### Implementing Database Sharding

Here's how to implement basic database sharding:

```typescript
interface ShardConfig {
  id: number;
  connection: string;
}

class ShardManager {
  private shards: Map<number, DrizzleDatabase>;
  private shardCount: number;

  constructor(shardConfigs: ShardConfig[]) {
    this.shards = new Map();
    this.shardCount = shardConfigs.length;

    // Initialize connections to all shards
    for (const config of shardConfigs) {
      const connection = postgres(config.connection);
      this.shards.set(config.id, drizzle(connection));
    }
  }

  // Get shard for a specific user
  private getShardForUser(userId: string): DrizzleDatabase {
    const shardId = this.calculateShardId(userId);
    const shard = this.shards.get(shardId);
    if (!shard) {
      throw new Error(`Shard ${shardId} not found`);
    }
    return shard;
  }

  // Calculate shard ID based on user ID
  private calculateShardId(userId: string): number {
    // Simple hash function for demonstration
    const hash = userId.split('').reduce(
      (acc, char) => acc + char.charCodeAt(0),
      0
    );
    return hash % this.shardCount;
  }

  // Execute query on appropriate shard
  async executeOnShard<T>(
    userId: string,
    queryFn: (db: DrizzleDatabase) => Promise<T>
  ): Promise<T> {
    const shard = this.getShardForUser(userId);
    return queryFn(shard);
  }
}

// Usage example
const shardManager = new ShardManager([
  { id: 0, connection: 'postgresql://shard0' },
  { id: 1, connection: 'postgresql://shard1' },
  { id: 2, connection: 'postgresql://shard2' }
]);

// Get user's posts across shards
const getUserPosts = async (userId: string) => {
  return shardManager.executeOnShard(userId, (db) =>
    db.select()
      .from(postsTable)
      .where(eq(postsTable.userId, userId))
  );
};
```

### Implementing Read Replicas

Let's implement a system that distributes reads across replicas:

```typescript
class DatabaseCluster {
  private primary: DrizzleDatabase;
  private replicas: DrizzleDatabase[];
  private currentReplica: number = 0;

  constructor(
    primaryConnection: string,
    replicaConnections: string[]
  ) {
    this.primary = drizzle(postgres(primaryConnection));
    this.replicas = replicaConnections.map(conn => 
      drizzle(postgres(conn))
    );
  }

  // Get next replica using round-robin
  private getNextReplica(): DrizzleDatabase {
    const replica = this.replicas[this.currentReplica];
    this.currentReplica = (this.currentReplica + 1) % this.replicas.length;
    return replica;
  }

  // Execute read query on a replica
  async read<T>(
    queryFn: (db: DrizzleDatabase) => Promise<T>
  ): Promise<T> {
    const replica = this.getNextReplica();
    return queryFn(replica);
  }

  // Execute write query on primary
  async write<T>(
    queryFn: (db: DrizzleDatabase) => Promise<T>
  ): Promise<T> {
    return queryFn(this.primary);
  }
}

// Usage example
const cluster = new DatabaseCluster(
  'postgresql://primary',
  [
    'postgresql://replica1',
    'postgresql://replica2'
  ]
);

// Read operation
const getPosts = async () => {
  return cluster.read(db =>
    db.select().from(postsTable)
  );
};

// Write operation
const createPost = async (data: NewPost) => {
  return cluster.write(db =>
    db.insert(postsTable).values(data)
  );
};
```

## Security Hardening Measures

### Implementing Rate Limiting with Redis

Let's create a sophisticated rate limiting system:

```typescript
class RateLimiter {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
  }

  async isRateLimited(
    key: string,
    limit: number,
    window: number // in seconds
  ): Promise<boolean> {
    const current = await this.redis.incr(key);
    
    // Set expiry on first request
    if (current === 1) {
      await this.redis.expire(key, window);
    }

    return current > limit;
  }

  async getRemainingRequests(key: string): Promise<number> {
    const [current, ttl] = await Promise.all([
      this.redis.get(key),
      this.redis.ttl(key)
    ]);

    if (!current || ttl === -1) {
      return Infinity;
    }

    return Math.max(0, parseInt(current));
  }
}

// Implement rate limiting middleware
const rateLimitMiddleware = (
  limit: number = 100,
  window: number = 3600 // 1 hour
) => {
  const limiter = new RateLimiter();

  return createMiddleware<Context>(async (c, next) => {
    const ip = c.req.header("x-forwarded-for") || c.req.ip;
    const key = `ratelimit:${ip}`;

    if (await limiter.isRateLimited(key, limit, window)) {
      throw new HTTPException(429, {
        message: "Too many requests",
        headers: {
          "Retry-After": String(window)
        }
      });
    }

    // Add rate limit headers
    const remaining = await limiter.getRemainingRequests(key);
    c.header("X-RateLimit-Limit", String(limit));
    c.header("X-RateLimit-Remaining", String(remaining));

    await next();
  });
}
```

### Implementing Input Validation and Sanitization

Let's create a robust input validation system:

```typescript
interface ValidationRule {
  validate: (value: any) => boolean;
  message: string;
}

class InputValidator {
  private rules: Map<string, ValidationRule[]> = new Map();

  // Add validation rule for a field
  addRule(field: string, rule: ValidationRule) {
    if (!this.rules.has(field)) {
      this.rules.set(field, []);
    }
    this.rules.get(field)!.push(rule);
  }

  // Validate input object
  validate(input: Record<string, any>): ValidationError[] {
    const errors: ValidationError[] = [];

    for (const [field, rules] of this.rules.entries()) {
      const value = input[field];
      for (const rule of rules) {
        if (!rule.validate(value)) {
          errors.push({
            field,
            message: rule.message
          });
        }
      }
    }

    return errors;
  }

  // Common validation rules
  static readonly rules = {
    required: (): ValidationRule => ({
      validate: (value) => value !== undefined && value !== null && value !== '',
      message: "Field is required"
    }),

    minLength: (min: number): ValidationRule => ({
      validate: (value) => String(value).length >= min,
      message: `Minimum length is ${min} characters`
    }),

    maxLength: (max: number): ValidationRule => ({
      validate: (value) => String(value).length <= max,
      message: `Maximum length is ${max} characters`
    }),

    pattern: (regex: RegExp, message: string): ValidationRule => ({
      validate: (value) => regex.test(String(value)),
      message
    }),

    custom: (fn: (value: any) => boolean, message: string): ValidationRule => ({
      validate: fn,
      message
    })
  };
}

// Implementing content sanitization
class ContentSanitizer {
  private allowedTags: string[];
  private allowedAttributes: Record<string, string[]>;

  constructor(
    allowedTags: string[] = ['p', 'b', 'i', 'em', 'strong'],
    allowedAttributes: Record<string, string[]> = {}
  ) {
    this.allowedTags = allowedTags;
    this.allowedAttributes = allowedAttributes;
  }

  sanitize(content: string): string {
    // This is a simple example - in production use a proper HTML sanitizer library
    const doc = new DOMParser().parseFromString(content, 'text/html');
    this.sanitizeNode(doc.body);
    return doc.body.innerHTML;
  }

  private sanitizeNode(node: Node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      
      // Remove disallowed tags
      if (!this.allowedTags.includes(element.tagName.toLowerCase())) {
        element.replaceWith(...element.childNodes);
        return;
      }

      // Remove disallowed attributes
      const allowedAttrs = this.allowedAttributes[element.tagName.toLowerCase()] || [];
      for (const attr of Array.from(element.attributes)) {
        if (!allowedAttrs.includes(attr.name)) {
          element.removeAttribute(attr.name);
        }
      }
    }

    // Recursively sanitize child nodes
    for (const child of Array.from(node.childNodes)) {
      this.sanitizeNode(child);
    }
  }
}
```

### Implementing Secure Session Management

Let's enhance our session security:

```typescript
interface SessionOptions {
  maxAge: number;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  httpOnly: boolean;
  path: string;
}

class SessionManager {
  private redis: Redis;
  private options: SessionOptions;

  constructor(
    redisUrl: string,
    options: Partial<SessionOptions> = {}
  ) {
    this.redis = new Redis(redisUrl);
    this.options = {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      httpOnly: true,
      path: '/',
      ...options
    };
  }

  async createSession(
    userId: string,
    data: Record<string, any> = {}
  ): Promise<string> {
    const sessionId = crypto.randomUUID();
    const sessionData = {
      userId,
      data,
      createdAt: Date.now()
    };

    await this.redis.setex(
      `session:${sessionId}`,
      this.options.maxAge / 1000,
      JSON.stringify(sessionData)
    );

    return sessionId;
  }

  async getSession(sessionId: string): Promise<any | null> {
    const data = await this.redis.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  }

  async updateSession(
    sessionId: string,
    data: Record<string, any>
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    session.data = { ...session.data, ...data };
    await this.redis.setex(
      `session:${sessionId}`,
      this.options.maxAge / 1000,
      JSON.stringify(session)
    );
  }

  async destroySession(sessionId: string): Promise<void> {
    await this.redis.del(`session:${sessionId}`);
  }

  getCookieOptions(): CookieSerializeOptions {
    return {
      maxAge: this.options.maxAge,
      secure: this.options.secure,
      sameSite: this.options.sameSite,
      httpOnly: this.options.httpOnly,
      path: this.options.path
    };
  }
}

// Implementing secure session middleware
const sessionMiddleware = (sessionManager: SessionManager) => {
  return createMiddleware<Context>(async (c, next) => {
    const sessionId = c.req.cookie('session');
    
    if (sessionId) {
      const session = await sessionManager.getSession(sessionId);
      if (session) {
        c.set('session', session);
      }
    }

    await next();
  });
};
```
### Implementing XSS Protection

Let's create a middleware for XSS protection:

```typescript
const xssProtectionMiddleware = createMiddleware<Context>(async (c, next) => {
  // Set security headers
  c.header("X-XSS-Protection", "1; mode=block");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  
  // Set strict Content Security Policy
  c.header("Content-Security-Policy", [
    "default-src 'self'",
    "script-src 'self' 'nonce-{NONCE}' 'strict-dynamic'",
    "style-src 'self' 'nonce-{NONCE}'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "block-all-mixed-content",
    "upgrade-insecure-requests"
  ].join("; "));

  await next();
});
```
### Implementing CSRF Protection

Let's create a robust CSRF protection system:

```typescript
class CSRFProtection {
  private redis: Redis;
  private secret: string;

  constructor(redisUrl: string, secret: string) {
    this.redis = new Redis(redisUrl);
    this.secret = secret;
  }

  // Generate CSRF token
  async generateToken(sessionId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const hash = crypto
      .createHmac('sha256', this.secret)
      .update(sessionId + token)
      .digest('hex');

    await this.redis.setex(
      `csrf:${token}`,
      3600, // 1 hour
      hash
    );

    return token;
  }

  // Validate CSRF token
  async validateToken(
    token: string,
    sessionId: string
  ): Promise<boolean> {
    const storedHash = await this.redis.get(`csrf:${token}`);
    if (!storedHash) return false;

    const expectedHash = crypto
      .createHmac('sha256', this.secret)
      .update(sessionId + token)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(storedHash),
      Buffer.from(expectedHash)
    );
  }
}

// CSRF middleware
const csrfMiddleware = (csrfProtection: CSRFProtection) => {
  return createMiddleware<Context>(async (c, next) => {
    const method = c.req.method;
    
    // Skip CSRF check for GET, HEAD, OPTIONS
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      await next();
      return;
    }

    const token = c.req.header('X-CSRF-Token');
    const session = c.get('session');

    if (!token || !session) {
      throw new HTTPException(403, {
        message: 'CSRF token missing or invalid'
      });
    }

    const isValid = await csrfProtection.validateToken(
      token,
      session.id
    );

    if (!isValid) {
      throw new HTTPException(403, {
        message: 'Invalid CSRF token'
      });
    }

    await next();
  });
};
```