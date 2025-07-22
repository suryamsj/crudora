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
- 🔄 **Lifecycle Hooks**: beforeCreate, afterCreate, beforeUpdate, afterUpdate, beforeDelete, afterDelete, beforeFind, afterFind
- 🔒 **Field Security**: Hidden fields support with automatic filtering
- 🎛️ **Dynamic Selection**: Smart field selection based on fillable and hidden properties
- ⚡ **Auto Setup**: Intelligent postinstall script for quick project initialization
- 🔄 **TypeScript First**: Native TypeScript support with ESM modules
- 🖥️ **CLI Tool**: Command-line interface for project initialization and scaffolding

## Installation

```bash
npm install crudora prisma @prisma/client
# or
yarn add crudora prisma @prisma/client
```

**Note**: After installation, Crudora automatically sets up your project with:

- Prisma schema template
- Environment configuration (.env)
- Basic server setup (server.ts)
- Useful npm scripts

## CLI Usage

Crudora comes with a built-in CLI tool for quick project initialization and database management:

```bash
# Initialize a new Crudora project in the current directory
npx crudora init

# Start Prisma Studio for database management
npx crudora studio

# Generate Prisma Client
npx crudora generate

# Push Prisma schema to database
npx crudora push

# Run Prisma migrations
npx crudora migrate
```

### CLI Commands

- `init` - Initialize a new Crudora project with necessary files (schema.prisma, .env, server.ts, tsconfig.json)
- `studio` - Start Prisma Studio for visual database management
- `generate` - Generate Prisma Client based on your schema
- `push` - Push Prisma schema to your database without migrations
- `migrate` - Run Prisma migrations for schema changes

## Quick Start

### Basic Usage

```typescript
import { CrudoraServer, Model } from "crudora";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

class User extends Model {
  static tableName = "users";
  static primaryKey = "id";
  static timestamps = true;
  static fillable = ["name", "email", "password"];
  static hidden = ["password"];

  // Lifecycle hooks
  static async beforeCreate(data: any): Promise<any> {
    data.password = await hashPassword(data.password);
    return data;
  }

  static async afterCreate(data: any, result: any): Promise<any> {
    console.log(`User created: ${result.email}`);
    return result;
  }
}

class Post extends Model {
  static tableName = "posts";
  static fillable = ["title", "content", "authorId"];
  static hidden = ["deletedAt"];
}

const server = new CrudoraServer({
  port: 3000,
  prisma: prisma,
});

server
  .registerModel(User, Post)
  .generateRoutes()
  .listen(() => {
    console.log("Server running on port 3000");
  });
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

### Lifecycle Hooks

Crudora supports comprehensive lifecycle hooks for all CRUD operations:

```typescript
class User extends Model {
  static tableName = "users";
  static fillable = ["name", "email", "password"];
  static hidden = ["password"];

  // Create hooks
  static async beforeCreate(data: any): Promise<any> {
    data.password = await hashPassword(data.password);
    data.createdAt = new Date();
    return data;
  }

  static async afterCreate(data: any, result: any): Promise<any> {
    await sendWelcomeEmail(result.email);
    await logUserCreation(result.id);
    return result;
  }

  // Update hooks
  static async beforeUpdate(id: string, data: any): Promise<any> {
    data.updatedAt = new Date();
    return data;
  }

  static async afterUpdate(id: string, data: any, result: any): Promise<any> {
    await logUserUpdate(id, data);
    return result;
  }

  // Delete hooks
  static async beforeDelete(id: string): Promise<void> {
    await archiveUserData(id);
  }

  static async afterDelete(id: string, result: any): Promise<any> {
    await logUserDeletion(id);
    return result;
  }

  // Find hooks
  static async beforeFind(options: any): Promise<any> {
    // Add default filters
    options.where = { ...options.where, active: true };
    return options;
  }

  static async afterFind(result: any): Promise<any> {
    // Transform result
    if (Array.isArray(result)) {
      return result.map((user) => ({ ...user, displayName: user.name }));
    }
    return { ...result, displayName: result.name };
  }
}
```

### Field Security and Dynamic Selection

Crudora automatically handles field security and dynamic selection:

```typescript
class User extends Model {
  static tableName = "users";
  static fillable = ["name", "email", "bio"]; // Only these fields can be mass-assigned
  static hidden = ["password", "secret"]; // These fields are automatically excluded from responses
}

// API responses automatically exclude hidden fields
// Only fillable fields are included in select queries for better performance
```

### Using Repositories

```typescript
const crudora = server.getCrudora();
const userRepo = crudora.getRepository(User);

// Create user (triggers beforeCreate and afterCreate hooks)
const user = await userRepo.create({
  name: "John Doe",
  email: "john@example.com",
  password: "plaintext", // Will be hashed by beforeCreate hook
});
// Response excludes password due to hidden field

// Find users (triggers beforeFind and afterFind hooks)
const users = await userRepo.findAll({
  skip: 0,
  take: 10,
  where: { active: true },
  orderBy: { createdAt: "desc" },
});

// Update user (triggers beforeUpdate and afterUpdate hooks)
const updatedUser = await userRepo.update("user-id", {
  name: "John Updated",
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

## Project Setup

After installing Crudora, run these commands to complete setup:

```bash
# Install additional dependencies
npm install @prisma/client prisma dotenv

# Generate Prisma client
npm run db:generate

# Push database schema
npm run db:push

# Start development server
npm run dev
```

## Available Scripts

Crudora automatically adds these scripts to your package.json:

- `npm run dev` - Start development server with ts-node
- `npm run build` - Build TypeScript to JavaScript
- `npm run start` - Start production server from built JavaScript
- `npm run start:prod` - Build and start production server
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema to database
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio

## Documentation

- [API Reference](./docs/api.md)
- [Model Definition Guide](./docs/models.md)
- [Custom Routes](./docs/custom-routes.md)
- [CLI Reference](./docs/cli.md)
- [Deployment Guide](./docs/deployment.md)

## Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

## License

MIT © [Crudora](https://github.com/suryamsj/crudora)

---

**⚠️ Alpha Version - Not recommended for production use**
