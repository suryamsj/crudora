# Custom Routes Guide

Crudora allows you to add custom routes alongside the automatically generated CRUD endpoints.

## Basic Custom Routes

### Adding Custom Routes with CrudoraServer

```typescript
import { CrudoraServer } from 'crudora';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const server = new CrudoraServer({ port: 3000, prisma });

// Add custom routes
server
  .get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
  })
  .post('/auth/login', async (req, res) => {
    // Login logic
    const { email, password } = req.body;
    // ... authentication logic
    res.json({ token: 'jwt-token' });
  })
  .put('/users/:id/activate', async (req, res) => {
    const userId = req.params.id;
    // ... activation logic
    res.json({ message: 'User activated' });
  });
```

### Adding Custom Routes with Crudora

```typescript
import { Crudora } from 'crudora';
import express from 'express';

const app = express();
const crudora = new Crudora(prisma);

// Add custom routes
crudora
  .get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
  })
  .post('/auth/login', async (req, res) => {
    // Login logic
  });

// Generate routes
crudora.generateRoutes(app, '/api');
```

### HTTP Methods

Crudora supports all standard HTTP methods:

```typescript
server.get('/path', handler);     // GET
server.post('/path', handler);    // POST
server.put('/path', handler);     // PUT
server.delete('/path', handler);  // DELETE
server.patch('/path', handler);   // PATCH
```

## Advanced Custom Routes

### Using Repositories in Custom Routes

```typescript
server.post('/users/:id/posts', async (req, res) => {
  try {
    const userId = req.params.id;
    const postData = req.body;

    // Get repository instances
    const crudora = server.getCrudora();
    const userRepo = crudora.getRepository(User);
    const postRepo = crudora.getRepository(Post);

    // Verify user exists
    const user = await userRepo.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create post
    const post = await postRepo.create({
      ...postData,
      authorId: userId
    });

    res.status(201).json(post);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### Authentication Routes

```typescript
// Login endpoint
server.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  const userRepo = server.getCrudora().getRepository(User);
  const users = await userRepo.findAll({ where: { email } });

  if (!users.length || !verifyPassword(password, users[0].password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = generateJWT(users[0]);
  res.json({ token, user: users[0] });
});

// Register endpoint
server.post('/auth/register', async (req, res) => {
  const { name, email, password } = req.body;

  const userRepo = server.getCrudora().getRepository(User);

  // Check if user exists
  const existingUsers = await userRepo.findAll({ where: { email } });
  if (existingUsers.length) {
    return res.status(400).json({ error: 'User already exists' });
  }

  // Create user
  const hashedPassword = await hashPassword(password);
  const user = await userRepo.create({
    name,
    email,
    password: hashedPassword
  });

  const token = generateJWT(user);
  res.status(201).json({ token, user });
});
```

### Search and Filtering Routes

```typescript
// Advanced search
server.get('/search/users', async (req, res) => {
  const { q, category, minAge, maxAge } = req.query;

  const userRepo = server.getCrudora().getRepository(User);

  const whereClause: any = {};

  if (q) {
    whereClause.OR = [
      { name: { contains: q } },
      { email: { contains: q } }
    ];
  }

  if (category) {
    whereClause.category = category;
  }

  if (minAge || maxAge) {
    whereClause.age = {};
    if (minAge) whereClause.age.gte = parseInt(minAge as string);
    if (maxAge) whereClause.age.lte = parseInt(maxAge as string);
  }

  const users = await userRepo.findAll({ where: whereClause });
  res.json(users);
});
```

### Aggregation Routes

```typescript
// Statistics endpoint
server.get('/stats/users', async (req, res) => {
  const userRepo = server.getCrudora().getRepository(User);

  const [total, active, inactive] = await Promise.all([
    userRepo.count(),
    userRepo.count({ isActive: true }),
    userRepo.count({ isActive: false })
  ]);

  res.json({
    total,
    active,
    inactive,
    activePercentage: total > 0 ? (active / total) * 100 : 0
  });
});
```

### Validation in Custom Routes

```typescript
server.post('/users/bulk', async (req, res) => {
  try {
    const { users } = req.body;

    // Get validation schema
    const crudora = server.getCrudora();
    const schema = crudora.getStrictValidationSchema(User);

    // Validate each user
    const validatedUsers = [];
    for (const userData of users) {
      const result = schema.safeParse(userData);
      if (!result.success) {
        return res.status(400).json({
          error: 'Validation failed',
          details: result.error.errors
        });
      }
      validatedUsers.push(result.data);
    }

    // Create users
    const userRepo = crudora.getRepository(User);
    const createdUsers = [];

    for (const userData of validatedUsers) {
      const user = await userRepo.create(userData);
      createdUsers.push(user);
    }

    res.status(201).json(createdUsers);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### Middleware for Custom Routes

```typescript
// Add middleware before defining routes
server.use(express.json());
server.use(cors());

// Authentication middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  // Verify token logic here
  req.user = { id: 'user-id' }; // Set user from token
  next();
};

// Protected routes
server.get('/profile', authenticateToken, async (req: any, res) => {
  const userRepo = server.getCrudora().getRepository(User);
  const user = await userRepo.findById(req.user.id);
  res.json(user);
});
```

## Route Organization

### Grouping Routes

```typescript
// User-related routes
server
  .get('/users/profile', getUserProfile)
  .put('/users/profile', updateUserProfile)
  .post('/users/change-password', changePassword);

// Admin routes
server
  .get('/admin/stats', getAdminStats)
  .post('/admin/users/:id/ban', banUser)
  .delete('/admin/users/:id', deleteUser);

// API versioning
server
  .get('/v1/users', getUsersV1)
  .get('/v2/users', getUsersV2);
```

### Error Handling

```typescript
// Global error handler
server.use((err: any, req: any, res: any, next: any) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Custom error handling in routes
server.get('/users/:id', async (req, res) => {
  try {
    const userRepo = server.getCrudora().getRepository(User);
    const user = await userRepo.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});
```

## Best Practices

1. **Use repositories** for database operations instead of direct Prisma calls
2. **Validate input** using Crudora's validation schemas or custom validation
3. **Handle errors gracefully** with proper HTTP status codes
4. **Use middleware** for common functionality like authentication
5. **Group related routes** for better organization
6. **Follow RESTful conventions** when possible
7. **Add proper error handling** for all async operations
8. **Test your custom routes** thoroughly
9. **Use async/await** for better error handling
10. **Test your custom routes** thoroughly

## Route Organization

For larger applications, consider organizing routes in separate files:

```typescript
// routes/auth.ts
export const authRoutes = (crudora: Crudora) => {
  crudora
    .post('/auth/login', loginHandler)
    .post('/auth/register', registerHandler)
    .post('/auth/logout', logoutHandler)
}

// routes/users.ts
export const userRoutes = (crudora: Crudora) => {
  crudora
    .get('/users/search', searchUsers)
    .put('/users/:id/activate', activateUser)
    .get('/users/stats', getUserStats)
}

// main.ts
import { authRoutes } from './routes/auth'
import { userRoutes } from './routes/users'

authRoutes(crudora)
userRoutes(crudora)
```
