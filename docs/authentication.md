# Authentication Guide

Crudora does **not** include built-in authentication. This is intentional — auth strategies (JWT, session, OAuth, API key) vary too much across projects to bake in one approach.

Instead, Crudora exposes standard Express middleware hooks so you can plug in any auth strategy and control exactly which routes are protected.

---

## Protecting Auto-Generated Routes

Use `server.getApp()` to access the underlying Express instance and mount middleware on the auto-generated routes path before calling `generateRoutes()`.

```typescript
import { CrudoraServer, Model, Field } from 'crudora';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL }));
const server = new CrudoraServer({ db, dialect: 'postgresql', port: 3000 });

// Protect every auto-generated route under /api
server.getApp().use('/api', verifyJWT);

server
  .registerModel(User, Post)
  .generateRoutes()   // /api/users, /api/posts — all behind verifyJWT
  .listen();
```

To protect only specific models, mount on a more specific path:

```typescript
// Only /api/posts and /api/comments require auth — /api/products is public
server.getApp().use('/api/posts',    verifyJWT);
server.getApp().use('/api/comments', verifyJWT);
```

---

## Per-Route Middleware

Pass middleware as additional arguments to any custom route method:

```typescript
server.get('/profile', verifyJWT, async (req: any, res) => {
  const userRepo = server.getCrudora().getRepository(User);
  const user = await userRepo.findById(req.user.id);
  if (!user) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, data: user });
});

server.delete('/account', verifyJWT, requireRole('admin'), async (req: any, res) => {
  // only admins reach here
});
```

---

## Login Route

> **Important:** `findOne()` and all repository methods strip `hidden` fields at query time.
> If `password` is in `static hidden = ['password']`, `user.password` will be `undefined`.
> Pass `{ includeHidden: true }` to temporarily bypass hidden-field stripping.

```typescript
server.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'email and password are required' });
  }

  const userRepo = server.getCrudora().getRepository(User);

  // includeHidden: true bypasses static hidden so password hash is readable
  const row = await userRepo.findOne({ email }, { includeHidden: true });

  if (!row || !verifyPassword(password, (row as any).password)) {
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }

  // Strip the hash before sending the response
  const { password: _pw, ...safeUser } = row as any;
  res.json({ success: true, data: { token: generateJWT(safeUser) } });
});
```

---

## Register Route

The `beforeCreate` lifecycle hook is the right place to hash the password — it runs before the row is inserted, and the hash is what gets stored:

```typescript
class User extends Model {
  static tableName = 'users';
  static hidden    = ['password'];

  @Field({ type: 'uuid', primary: true }) id!: string;
  @Field({ type: 'string', required: true, unique: true }) email!: string;
  @Field({ type: 'string', required: true }) password!: string;

  static async beforeCreate(data: any) {
    data.password = await hashPassword(data.password);
    return data;
  }
}

server.post('/auth/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'email and password are required' });
  }

  const userRepo = server.getCrudora().getRepository(User);

  const exists = await userRepo.exists({ email });
  if (exists) {
    return res.status(409).json({ success: false, error: 'Email already registered' });
  }

  // beforeCreate hashes the password; the returned user has password stripped by hidden
  const user = await userRepo.create({ email, password });
  res.status(201).json({ success: true, data: { token: generateJWT(user), user } });
});
```

---

## JWT Middleware Example

A minimal `verifyJWT` middleware you can adapt:

```typescript
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;

export function verifyJWT(req: any, res: any, next: any) {
  const header = req.headers['authorization'];
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Access token required' });
  }

  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

export function requireRole(role: string) {
  return (req: any, res: any, next: any) => {
    if (req.user?.role !== role) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    next();
  };
}
```

---

## Full Example

```typescript
import { CrudoraServer, Model, Field } from 'crudora';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { verifyJWT } from './middleware/auth';

const db     = drizzle(new Pool({ connectionString: process.env.DATABASE_URL }));
const server = new CrudoraServer({ db, dialect: 'postgresql', port: 3000 });

// Auth routes — public, no verifyJWT
server
  .post('/auth/register', registerHandler)
  .post('/auth/login',    loginHandler);

// All auto-generated CRUD routes require a valid JWT
server.getApp().use('/api', verifyJWT);

server
  .registerModel(User, Post)
  .generateRoutes()
  .listen();
```
