# Crudora

Automatic CRUD API generator for TypeScript with Prisma - Build REST APIs in minutes, not hours.

[![npm version](https://badge.fury.io/js/crudora.svg)](https://badge.fury.io/js/crudora)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## ✨ Features

- 🚀 **Zero Configuration**: Generate CRUD APIs instantly
- 🎯 **Type-Safe**: Full TypeScript support with Prisma integration
- 🔧 **Flexible**: Support for both decorator and inheritance patterns
- 📊 **Auto Pagination**: Built-in pagination and filtering
- 🛡️ **Validation**: Automatic request validation with Zod
- 🔌 **Extensible**: Custom routes and middleware support
- 📖 **Schema Generation**: Auto-generate Prisma schemas from models
- 🗄️ **Repository Pattern**: Built-in repository for database operations

## Installation

```bash
npm install crudora prisma @prisma/client
# or
yarn add crudora prisma @prisma/client
```

## Quick Start

### Method 1: Simple Inheritance (Recommended)

```typescript
import { CrudoraServer, Model } from "crudora";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Define your models
class User extends Model {
  static tableName = "users";
  static primaryKey = "id";
  static timestamps = true;
  static fillable = ["name", "email"];
  static hidden = ["password"];
}

class Post extends Model {
  static tableName = "posts";
  static fillable = ["title", "content", "authorId"];
}

// Create server and register models
const server = new CrudoraServer({
  port: 3000,
  prisma: prisma,
  cors: true,
  basePath: "/api",
});

server
  .registerModel(User, Post)
  .generateRoutes()
  .listen(() => {
    console.log("Server running on port 3000");
  });
```

### Method 2: Decorator Pattern

```typescript
import { CrudoraServer, Model, Field } from "crudora";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

@Model({ tableName: "users" })
class User {
  @Field({ type: "uuid", primary: true })
  id!: string;

  @Field({ type: "string", required: true })
  name!: string;

  @Field({ type: "string", unique: true, required: true })
  email!: string;

  @Field({ type: "date" })
  createdAt!: Date;

  @Field({ type: "date" })
  updatedAt!: Date;
}

const server = new CrudoraServer({
  port: 3000,
  prisma: prisma,
});

server.registerModel(User).generateRoutes().listen();
```

## Generated API Endpoints

For each registered model, Crudora automatically generates:

- `GET /api/{tableName}` - List all records with pagination and filtering
- `GET /api/{tableName}/:id` - Get record by ID
- `POST /api/{tableName}` - Create new record
- `PUT /api/{tableName}/:id` - Update record
- `DELETE /api/{tableName}/:id` - Delete record

### Query Parameters

- `skip` - Number of records to skip (pagination)
- `take` - Number of records to take (pagination)
- `orderBy` - Sort order (e.g., `createdAt:desc`)
- `where` - Filter conditions

## Advanced Usage

### Using Repositories

```typescript
const crudora = server.getCrudora();
const userRepo = crudora.getRepository(User);

// Create user
const user = await userRepo.create({
  name: "John Doe",
  email: "john@example.com",
});

// Find users
const users = await userRepo.findAll({
  skip: 0,
  take: 10,
  where: { active: true },
  orderBy: { createdAt: "desc" },
});

// Count users
const count = await userRepo.count({ active: true });
```

### Custom Routes

```typescript
server
  .get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date() });
  })
  .post("/users/:id/activate", async (req, res) => {
    const userRepo = server.getCrudora().getRepository(User);
    const user = await userRepo.update(req.params.id, { active: true });
    res.json(user);
  });
```

### Schema Generation

```typescript
// Generate Prisma schema from your models
const schema = server.getCrudora().generatePrismaSchema("postgresql");
console.log(schema);
```

### Validation

Crudora automatically generates Zod validation schemas:

```typescript
const crudora = server.getCrudora();

// Get partial validation schema (for updates)
const partialSchema = crudora.getValidationSchema(User);

// Get strict validation schema (for creation)
const strictSchema = crudora.getStrictValidationSchema(User);
```

## Documentation

- [API Reference](./docs/api.md)
- [Model Definition Guide](./docs/models.md)
- [Custom Routes](./docs/custom-routes.md)
- [Deployment Guide](./docs/deployment.md)

## Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

## License

MIT © [Crudora](https://github.com/suryamsj/crudora)

---

**⚠️ Alpha Version - Not recommended for production use**
