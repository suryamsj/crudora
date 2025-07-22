# Model Definition Guide

Crudora supports two approaches for defining models: **Inheritance Pattern** (recommended) and **Decorator Pattern**.

## Inheritance Pattern (Recommended)

The inheritance pattern provides a clean, simple way to define models similar to other ORMs.

### Basic Model Definition

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

### Model Configuration Options

#### tableName

Specifies the database table name. **Required** for proper route generation.

```typescript
class User extends Model {
  static tableName = "users"; // Required
}
```

#### primaryKey

Specifies the primary key field. Defaults to 'id'.

```typescript
class User extends Model {
  static tableName = "users";
  static primaryKey = "uuid"; // Custom primary key
}
```

#### timestamps

Enables automatic timestamp fields (createdAt, updatedAt). Defaults to true.

```typescript
class User extends Model {
  static tableName = "users";
  static timestamps = false; // Disable timestamps
}
```

#### fillable

Specifies which fields can be mass-assigned during create/update operations.

```typescript
class User extends Model {
  static tableName = "users";
  static fillable = ["name", "email", "password"];
}
```

#### hidden

Specifies fields that should be hidden from API responses.

```typescript
class User extends Model {
  static tableName = "users";
  static hidden = ["password", "deletedAt"];
}
```

### TypeScript Interface Integration

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

## Decorator Pattern

The decorator pattern provides more explicit field definitions with metadata and automatic validation schema generation.

### Setup

First, ensure you import `reflect-metadata` at the top of your application:

```typescript
import "reflect-metadata";
```

### Basic Usage

```typescript
import { Model, Field } from "crudora";

@Model({ tableName: "users" })
class User {
  @Field({ type: "uuid", primary: true })
  id!: string;

  @Field({ type: "string", required: true })
  name!: string;

  @Field({ type: "string", unique: true, required: true })
  email!: string;

  @Field({ type: "string", required: false })
  password!: string;

  @Field({ type: "date" })
  createdAt!: Date;

  @Field({ type: "date" })
  updatedAt!: Date;
}
```

### Model Decorator Options

```typescript
@Model({
  tableName: "users",    // Required: table name
  timestamps: true       // Optional: enable timestamps (default: true)
})
class User {
  // ... fields
}
```

### Field Types

Supported field types in the decorator pattern:

#### String Fields

```typescript
@Field({ type: "string", required: true, length: 255 })
name!: string;

@Field({ type: "string", required: false })
description!: string;
```

#### Numeric Fields

```typescript
@Field({ type: "number", required: true })
age!: number;

@Field({ type: "number", required: false })
price!: number;
```

#### Boolean Fields

```typescript
@Field({ type: "boolean", required: false })
isActive!: boolean;
```

#### Date Fields

```typescript
@Field({ type: "date" })
createdAt!: Date;

@Field({ type: "date" })
birthDate!: Date;
```

#### UUID Fields

```typescript
@Field({ type: "uuid", primary: true })
id!: string;

@Field({ type: "uuid", required: true })
userId!: string;
```

### Field Options

Available options for `@Field` decorator:

```typescript
@Field({
  type: "string",        // Field data type (required)
  required: true,        // Whether field is required (default: true)
  unique: false,         // Whether field must be unique (default: false)
  primary: false,        // Whether field is primary key (default: false)
  default: undefined,    // Default value
  length: undefined      // Maximum length for string fields
})
```

### Complete Example

```typescript
import "reflect-metadata";
import { Model, Field } from "crudora";

@Model({ tableName: "users" })
class User {
  @Field({ type: "uuid", primary: true })
  id!: string;

  @Field({ type: "string", required: true, length: 100 })
  name!: string;

  @Field({ type: "string", required: true, unique: true, length: 255 })
  email!: string;

  @Field({ type: "string", required: false })
  password!: string;

  @Field({ type: "number", required: false })
  age!: number;

  @Field({ type: "boolean", required: false })
  isActive!: boolean;

  @Field({ type: "date" })
  createdAt!: Date;

  @Field({ type: "date" })
  updatedAt!: Date;
}

@Model({ tableName: "posts" })
class Post {
  @Field({ type: "uuid", primary: true })
  id!: string;

  @Field({ type: "string", required: true, length: 200 })
  title!: string;

  @Field({ type: "string", required: true })
  content!: string;

  @Field({ type: "uuid", required: true })
  authorId!: string;

  @Field({ type: "boolean", required: false })
  published!: boolean;

  @Field({ type: "date" })
  createdAt!: Date;

  @Field({ type: "date" })
  updatedAt!: Date;
}
```

## Validation

When using the decorator pattern, Crudora automatically generates Zod validation schemas based on your field definitions:

```typescript
// Automatic validation for API endpoints
// - POST requests use strict validation (all required fields)
// - PUT requests use partial validation (all fields optional)

// You can also access the schemas programmatically:
const crudora = new Crudora(prisma);
crudora.registerModel(User);

const partialSchema = crudora.getValidationSchema(User);
const strictSchema = crudora.getStrictValidationSchema(User);
```

## Schema Generation

Both patterns support automatic Prisma schema generation:

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

1. **Use inheritance pattern** for simple models without complex validation
2. **Use decorator pattern** when you need automatic validation and detailed field metadata
3. **Always specify tableName** explicitly
4. **Use TypeScript interfaces** for better type safety
5. **Import reflect-metadata** when using decorators
6. **Keep field names consistent** with your database schema

## Model Type Definitions

Untuk type safety yang lebih baik, gunakan ModelConstructor type:

```typescript
import { Model, ModelConstructor } from "crudora";

// Definisi dengan type safety
const registerModels = <T extends Model>(...models: ModelConstructor<T>[]) => {
  return crudora.registerModel(...models);
};
```
