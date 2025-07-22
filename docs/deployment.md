# Deployment Guide

🚧 **Coming Soon**

This guide will be available after Crudora reaches stable version (v1.0).

## What's Coming

- Docker deployment
- Cloud platform guides (AWS, Google Cloud, Azure)
- Environment configuration
- Production optimizations
- Monitoring and logging
- CI/CD pipeline examples
- Performance tuning
- Security best practices

## Current Status

Crudora is currently in **alpha development** and not recommended for production use. We're working hard to make it production-ready!

## Development Deployment

For development and testing purposes, you can deploy Crudora applications using:

### Basic Express Server

```typescript
import { CrudoraServer } from "crudora";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const server = new CrudoraServer({
  port: process.env.PORT || 3000,
  prisma,
  cors: true,
  basePath: "/api",
});

server
  .registerModel(User, Post)
  .generateRoutes()
  .listen(() => {
    console.log(`Server running on port ${process.env.PORT || 3000}`);
  });
```

### Environment Variables

```bash
# .env
DATABASE_URL="postgresql://username:password@localhost:5432/mydb"
PORT=3000
NODE_ENV=development
```

### Package.json Scripts

```json
{
  "scripts": {
    "dev": "ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev"
  }
}
```

## Stay Updated

- ⭐ Star this repository to get notified of updates
- 📖 Check our [roadmap](../README.md#roadmap-timeline) for development progress
- 🐛 Report issues on [GitHub Issues](https://github.com/suryamsj/crudora/issues)

## Early Access

If you're interested in testing Crudora in a development environment, please:

1. Follow the [Quick Start guide](../README.md#quick-start)
2. Join our community discussions
3. Provide feedback on your experience

---

**Expected Release:** 2026 (with v1.0 stable release)
