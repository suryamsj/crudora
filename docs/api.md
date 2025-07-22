# API Reference

## Crudora Class

### Constructor

```typescript
new Crudora(prisma: PrismaClient)
```

Creates a new Crudora instance.

**Parameters:**
- `prisma` - PrismaClient instance

### Methods

#### registerModel(...modelClasses)

Registers one or more model classes with Crudora.

```typescript
crudora.registerModel(User, Post, Comment)
```

**Parameters:**
- `modelClasses` - Model classes that extend the base Model class or use decorators

**Returns:** `this` (for method chaining)

#### getRepository<T>(modelClass)

Gets the repository instance for a specific model.

```typescript
const userRepo = crudora.getRepository(User)
```

**Parameters:**
- `modelClass` - The model class

**Returns:** `Repository<T>` instance

#### generatePrismaSchema(databaseProvider?)

Generates Prisma schema from registered models.

```typescript
const schema = crudora.generatePrismaSchema('postgresql')
```

**Parameters:**
- `databaseProvider` (optional) - Database provider ('postgresql', 'mysql', 'sqlite'). Defaults to 'postgresql'

**Returns:** Generated Prisma schema as string

#### getValidationSchema<T>(modelClass)

Gets partial Zod validation schema for a model (used for updates).

```typescript
const schema = crudora.getValidationSchema(User)
```

**Parameters:**
- `modelClass` - The model class

**Returns:** `z.ZodType<Partial<T>>`

#### getStrictValidationSchema<T>(modelClass)

Gets strict Zod validation schema for a model (used for creation).

```typescript
const schema = crudora.getStrictValidationSchema(User)
```

**Parameters:**
- `modelClass` - The model class

**Returns:** `z.ZodType<T>`

#### Custom Route Methods

```typescript
crudora.get(path, handler)
crudora.post(path, handler)
crudora.put(path, handler)
crudora.delete(path, handler)
crudora.patch(path, handler)
```

**Parameters:**
- `path` - Route path
- `handler` - Express route handler function

**Returns:** `this` (for method chaining)

#### generateRoutes(app, basePath?)

Generates CRUD routes for all registered models.

```typescript
crudora.generateRoutes(app, '/api/v1')
```

**Parameters:**
- `app` - Express application instance
- `basePath` (optional) - Base path for routes (default: '/api')

## CrudoraServer Class

### Constructor

```typescript
new CrudoraServer(options: {
  port?: number;
  prisma: PrismaClient;
  cors?: boolean;
  middleware?: any[];
  basePath?: string;
})
```

**Options:**
- `port` - Server port (default: 3000)
- `prisma` - PrismaClient instance (required)
- `cors` - Enable CORS (default: true)
- `middleware` - Additional Express middleware array
- `basePath` - Base path for API routes (default: '/api')

### Methods

#### registerModel(...modelClasses)

Registers model classes with the underlying Crudora instance.

```typescript
server.registerModel(User, Post)
```

**Returns:** `this` (for method chaining)

#### generateRoutes()

Generates CRUD routes for all registered models.

```typescript
server.generateRoutes()
```

**Returns:** `this` (for method chaining)

#### use(middleware)

Adds middleware to the Express application.

```typescript
server.use(cors())
server.use(express.json())
```

#### getCrudora()

Gets the underlying Crudora instance.

```typescript
const crudora = server.getCrudora()
```

**Returns:** `Crudora` instance

#### Custom Route Methods

```typescript
server.get(path, handler)
server.post(path, handler)
server.put(path, handler)
server.delete(path, handler)
server.patch(path, handler)
```

#### listen(callback?)

Starts the server.

```typescript
server.listen(() => {
  console.log('Server started on port 3000')
})
```

## Repository Class

### Methods

#### create(data)

Creates a new record.

```typescript
const user = await userRepo.create({ name: 'John', email: 'john@example.com' })
```

**Parameters:**
- `data` - Object containing the data to create

**Returns:** Promise<T> - Created record

#### findById(id)

Finds a record by ID.

```typescript
const user = await userRepo.findById('123')
```

**Parameters:**
- `id` - Record ID

**Returns:** Promise<T | null> - Found record or null

#### findAll(options?)

Finds all records with optional filtering and pagination.

```typescript
const users = await userRepo.findAll({
  skip: 0,
  take: 10,
  where: { active: true },
  orderBy: { createdAt: 'desc' }
})
```

**Parameters:**
- `options` (optional) - Query options object
  - `skip` - Number of records to skip
  - `take` - Number of records to take
  - `where` - Filter conditions
  - `orderBy` - Sort order

**Returns:** Promise<T[]> - Array of records

#### update(id, data)

Updates a record by ID.

```typescript
const user = await userRepo.update('123', { name: 'Jane' })
```

**Parameters:**
- `id` - Record ID
- `data` - Object containing the data to update

**Returns:** Promise<T> - Updated record

#### delete(id)

Deletes a record by ID.

```typescript
await userRepo.delete('123')
```

**Parameters:**
- `id` - Record ID

**Returns:** Promise<T> - Deleted record

#### count(where?)

Counts records with optional filtering.

```typescript
const count = await userRepo.count({ active: true })
```

**Parameters:**
- `where` (optional) - Filter conditions

**Returns:** Promise<number> - Count of records

## Generated REST Endpoints

For each registered model, the following endpoints are automatically generated:

### GET /api/{tableName}

List all records with pagination and filtering.

**Query Parameters:**
- `skip` - Number of records to skip (default: 0)
- `take` - Number of records to take (default: 10)
- `orderBy` - Sort field and direction (e.g., 'createdAt:desc')
- `where` - Filter conditions (JSON string)

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "createdAt": "2023-01-01T00:00:00.000Z",
    "updatedAt": "2023-01-01T00:00:00.000Z"
  }
]
```

### GET /api/{tableName}/:id

Get a single record by ID.

**Response:**
```json
{
  "id": "uuid",
  "name": "John Doe",
  "email": "john@example.com",
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:00:00.000Z"
}
```

### POST /api/{tableName}

Create a new record.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com"
}
```

**Response:** Created record (201 status)

### PUT /api/{tableName}/:id

Update an existing record.

**Request Body:**
```json
{
  "name": "Jane Doe"
}
```

**Response:** Updated record (200 status)

### DELETE /api/{tableName}/:id

Delete a record.

**Response:** Deleted record (200 status)

## Error Responses

### 400 Bad Request
```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### 404 Not Found
```json
{
  "error": "Record not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

## Installation

```bash
npm install crudora@0.1.0-alpha.1
# Dependencies yang diperlukan:
npm install @prisma/client prisma
```

**Current Version**: 0.1.0-alpha.1
**Author**: Muhammad Surya J
**Repository**: https://github.com/suryamsj/crudora
