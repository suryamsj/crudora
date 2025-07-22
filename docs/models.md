# Model Definition Guide

Crudora uses an **Inheritance Pattern** for defining models, providing a clean and simple approach similar to other ORMs.

## Basic Model Definition

```typescript
import { Model } from "crudora";

class User extends Model {
  static tableName = "users";
  static primaryKey = "id";
  static timestamps = true;
  static fillable = ["name", "email"];
  static hidden = ["password"];
}

class Post extends Model {
  static tableName = "posts";
  static primaryKey = "id";
  static fillable = ["title", "content", "authorId"];
  static hidden = ["deletedAt"];
}
```

## Model Configuration Options

### tableName

Specifies the database table name. **Required** for proper route generation.

```typescript
class User extends Model {
  static tableName = "users"; // Required
}
```

### primaryKey

Specifies the primary key field. Defaults to 'id'.

```typescript
class User extends Model {
  static tableName = "users";
  static primaryKey = "uuid"; // Custom primary key
}
```

### timestamps

Enables automatic timestamp fields (createdAt, updatedAt). Defaults to true.

```typescript
class User extends Model {
  static tableName = "users";
  static timestamps = false; // Disable timestamps
}
```

### fillable

Specifies which fields can be mass-assigned during create/update operations.

```typescript
class User extends Model {
  static tableName = "users";
  static fillable = ["name", "email", "password"];
}
```

### hidden

Specifies fields that should be hidden from API responses.

```typescript
class User extends Model {
  static tableName = "users";
  static hidden = ["password", "deletedAt"];
}
```

## TypeScript Interface Integration

For better type safety, you can define TypeScript interfaces alongside your models:

```typescript
interface IUser {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

class User extends Model implements IUser {
  static tableName = "users";
  static fillable = ["name", "email"];

  id!: string;
  name!: string;
  email!: string;
  createdAt!: Date;
  updatedAt!: Date;
}
```

## Lifecycle Hooks

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
      return result.map(user => ({ ...user, displayName: user.name }));
    }
    return { ...result, displayName: result.name };
  }
}
```

## Complete Example

```typescript
import { Model } from "crudora";

interface IUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  age?: number;
  isActive?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

class User extends Model implements IUser {
  static tableName = "users";
  static primaryKey = "id";
  static timestamps = true;
  static fillable = ["name", "email", "password", "age", "isActive"];
  static hidden = ["password"];

  id!: string;
  name!: string;
  email!: string;
  password?: string;
  age?: number;
  isActive?: boolean;
  createdAt!: Date;
  updatedAt!: Date;

  static async beforeCreate(data: any): Promise<any> {
    if (data.password) {
      data.password = await hashPassword(data.password);
    }
    return data;
  }
}

class Post extends Model {
  static tableName = "posts";
  static primaryKey = "id";
  static fillable = ["title", "content", "authorId", "published"];
  static hidden = ["deletedAt"];

  id!: string;
  title!: string;
  content!: string;
  authorId!: string;
  published?: boolean;
  createdAt!: Date;
  updatedAt!: Date;
}
```

## Schema Generation

Crudora supports automatic Prisma schema generation:

```typescript
const crudora = new Crudora(prisma);
crudora.registerModel(User, Post);

const schema = crudora.generatePrismaSchema("postgresql");
console.log(schema);
```

This will generate a complete Prisma schema with:
- Proper field types
- Primary keys
- Unique constraints
- Timestamps (if enabled)
- Table mappings

## Best Practices

1. **Always specify tableName** explicitly
2. **Use TypeScript interfaces** for better type safety
3. **Keep field names consistent** with your database schema
4. **Use lifecycle hooks** for business logic and data transformation
5. **Configure fillable and hidden fields** appropriately for security
6. **Implement proper validation** in lifecycle hooks

## Model Type Definitions

For better type safety, use ModelConstructor type:

```typescript
import { Model, ModelConstructor } from "crudora";

// Definition with type safety
const registerModels = <T extends Model>(...models: ModelConstructor<T>[]) => {
  return crudora.registerModel(...models);
};
```
