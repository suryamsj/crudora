# CLI Reference

Crudora provides a powerful command-line interface (CLI) for project initialization and database management.

## Installation

The CLI is automatically installed when you install Crudora:

```bash
npm install crudora
```

You can then use the CLI with npx:

```bash
npx crudora <command>
```

## Available Commands

### init

Initializes a new Crudora project in the current directory.

```bash
npx crudora init
```

This command:

- Creates a Prisma schema template in the `prisma` directory
- Sets up environment configuration (`.env`)
- Creates a basic `server.ts` file with TypeScript and ESM support
- Adds useful npm scripts to `package.json` (dev, start, build, start:prod)
- Creates a `tsconfig.json` file with appropriate settings

### studio

Starts Prisma Studio for visual database management.

```bash
npx crudora studio
```

This command launches Prisma Studio, allowing you to view and edit your database data through a web interface.

### generate

Generates the Prisma Client based on your schema.

```bash
npx crudora generate
```

This command runs `npx prisma generate` to create the Prisma Client, which is required for database operations.

### push

Pushes your Prisma schema to the database without migrations.

```bash
npx crudora push
```

This command runs `npx prisma db push` to synchronize your database schema with your Prisma schema definition.

### migrate

Runs Prisma migrations for schema changes.

```bash
npx crudora migrate
```

This command runs `npx prisma migrate dev` to create and apply migrations for your database schema changes.

## Examples

### Complete Project Initialization

```bash
# Create a new directory for your project
mkdir my-crudora-api
cd my-crudora-api

# Initialize a new npm project
npm init -y

# Install Crudora and dependencies
npm install crudora @prisma/client prisma dotenv ts-node typescript

# Initialize Crudora project
npx crudora init

# Generate Prisma client
npx crudora generate

# Push schema to database
npx crudora push

# Start development server
npm run dev
```

### Database Management Workflow

```bash
# View and edit your database with Prisma Studio
npx crudora studio

# After making schema changes, update your database
npx crudora push

# For production environments, create migrations
npx crudora migrate
```
