# Custom Routes Guide

Crudora lets you add custom routes alongside the automatically generated CRUD endpoints.

All responses should use Crudora's standard JSON envelope for consistency:

```json
{ "success": true,  "data": ... }
{ "success": false, "error": "...", "details": [...] }
```

## Basic Custom Routes

```typescript
import { CrudoraServer, Model, Field } from 'crudora';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL }));
const server = new CrudoraServer({ db, dialect: 'postgresql', port: 3000 });

server
  .get('/health', (_req, res) => {
    res.json({ success: true, data: { status: 'ok', timestamp: new Date() } });
  })
  .post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    // ... authentication logic
    res.json({ success: true, data: { token: 'jwt-token' } });
  })
  .put('/users/:id/activate', async (req, res) => {
    // ... activation logic
    res.json({ success: true, data: { message: 'User activated' } });
  });
```

### Using Crudora Directly

```typescript
import { Crudora } from 'crudora';
import express from 'express';

const app = express();
const crudora = new Crudora(db, 'postgresql');

crudora
  .get('/health', (_req, res) => res.json({ success: true, data: { status: 'ok' } }))
  .post('/notify', async (req, res) => { /* ... */ });

crudora.generateRoutes(app, '/api');
```

### HTTP Methods

```typescript
server.get('/path', handler);
server.post('/path', handler);
server.put('/path', handler);
server.delete('/path', handler);
server.patch('/path', handler);
```

## Advanced Custom Routes

### Using Repositories

```typescript
server.post('/users/:id/posts', async (req, res) => {
  try {
    const crudora  = server.getCrudora();
    const userRepo = crudora.getRepository(User);
    const postRepo = crudora.getRepository(Post);

    const user = await userRepo.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const post = await postRepo.create({ ...req.body, authorId: user.id });
    res.status(201).json({ success: true, data: post });
  } catch {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
```

### Authentication Routes

> **Important:** `findOne()` and all repository methods strip `hidden` fields at query time.
> If `password` is in `static hidden`, `user.password` will be `undefined`.
> Pass `{ includeHidden: true }` to temporarily bypass hidden-field stripping.

```typescript
server.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const userRepo = server.getCrudora().getRepository(User);

  // includeHidden: true bypasses static hidden so password hash is readable
  const row = await userRepo.findOne({ email }, { includeHidden: true });

  if (!row || !verifyPassword(password, (row as any).password)) {
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }

  // Strip the hash before sending the response
  const { password: _pw, ...safeUser } = row as any;
  res.json({ success: true, data: { token: generateJWT(safeUser), user: safeUser } });
});

server.post('/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  const userRepo = server.getCrudora().getRepository(User);

  const exists = await userRepo.exists({ email });
  if (exists) return res.status(400).json({ success: false, error: 'User already exists' });

  // beforeCreate hook hashes the password before it reaches the DB
  const user = await userRepo.create({ name, email, password });
  res.status(201).json({ success: true, data: { token: generateJWT(user), user } });
});
```

### Aggregation Routes

```typescript
server.get('/stats/users', async (_req, res) => {
  const userRepo = server.getCrudora().getRepository(User);

  const [total, active] = await Promise.all([
    userRepo.count(),
    userRepo.count({ isActive: 'true' }),
  ]);

  res.json({ success: true, data: { total, active, inactive: total - active } });
});
```

### Bulk Create with `createMany`

```typescript
server.post('/users/bulk', async (req, res) => {
  try {
    const crudora  = server.getCrudora();
    const schema   = crudora.getStrictValidationSchema(User);
    const userRepo = crudora.getRepository(User);

    const parsed = schema.array().safeParse(req.body.users);
    if (!parsed.success) {
      return res.status(422).json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.issues,
      });
    }

    const created = await userRepo.createMany(parsed.data);
    res.status(201).json({ success: true, data: created });
  } catch {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
```

### Validation in Custom Routes

```typescript
server.post('/users/invite', async (req, res) => {
  try {
    const crudora  = server.getCrudora();
    const schema   = crudora.getStrictValidationSchema(User);
    const userRepo = crudora.getRepository(User);

    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(422).json({
        success: false,
        error:   'Validation error',
        details: result.error.issues,
      });
    }

    const user = await userRepo.create(result.data);
    res.status(201).json({ success: true, data: user });
  } catch {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
```

### Middleware for Custom Routes

```typescript
const authenticate = (req: any, res: any, next: any) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, error: 'Access token required' });
  req.user = verifyJWT(token);
  next();
};

// Apply to specific routes
server.get('/profile', authenticate, async (req: any, res) => {
  const userRepo = server.getCrudora().getRepository(User);
  const user = await userRepo.findById(req.user.id);
  if (!user) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, data: user });
});
```

### Cursor Pagination in Custom Routes

```typescript
server.get('/feed', async (req, res) => {
  const postRepo = server.getCrudora().getRepository(Post);

  const result = await postRepo.findWithCursor({
    take:   20,
    cursor: req.query.cursor as string | undefined,
    where:  { published: 'true' },
  });

  res.json({
    success: true,
    data:    result.data,
    meta:    { nextCursor: result.nextCursor },
  });
});
```

## Route Organization

For larger applications, organize routes in separate files:

```typescript
// routes/auth.ts
import { Crudora } from 'crudora';

export const authRoutes = (crudora: Crudora) => {
  crudora
    .post('/auth/login',    loginHandler)
    .post('/auth/register', registerHandler)
    .post('/auth/logout',   logoutHandler);
};

// routes/admin.ts
export const adminRoutes = (crudora: Crudora) => {
  crudora
    .get('/admin/stats',          getStats)
    .post('/admin/users/:id/ban', banUser);
};

// server.ts
import { authRoutes }  from './routes/auth';
import { adminRoutes } from './routes/admin';

authRoutes(server.getCrudora());
adminRoutes(server.getCrudora());
```

## Error Handling

```typescript
// Global error handler
server.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: 'Something went wrong' });
});

// Per-route error handling
server.get('/users/:id', async (req, res) => {
  try {
    const user = await server.getCrudora().getRepository(User).findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch user' });
  }
});
```

## Best Practices

1. **Use the `{ success, data/error }` envelope** in all custom route responses for consistency with auto-generated routes
2. **Use repositories** for database operations — never query the db directly in routes
3. **Use `findOne` / `exists`** instead of `findAll` when checking a single record
4. **Use `createMany`** for bulk inserts — it's a single query, not a loop of `create()` calls
5. **Validate input** with `getStrictValidationSchema()` or custom Zod schemas
6. **Handle errors** with proper HTTP status codes
7. **Use middleware** for cross-cutting concerns like authentication
8. **Group related routes** in separate files for maintainability
9. **Follow RESTful conventions** when possible
10. **Use `async/await`** — all repository methods are async
