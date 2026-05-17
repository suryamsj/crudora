import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Skip guards ──────────────────────────────────────────────────────────────
// Opt-out: set CRUDORA_SKIP_POSTINSTALL=1 in CI pipelines or Docker builds.
if (process.env.CRUDORA_SKIP_POSTINSTALL) {
  process.exit(0);
}

// Many CI systems set CI=true — don't scaffold files into a CI workspace.
if (process.env.CI) {
  process.exit(0);
}

// Running inside node_modules means someone else is installing crudora as a dep.
// Scaffold into their project root (process.cwd()), not the package directory.
// Guard: if there's no package.json in cwd, we're probably not in a real project.
const cwdPkgPath = path.join(process.cwd(), 'package.json');
if (!fs.existsSync(cwdPkgPath)) {
  process.exit(0);
}

// ─── Peer dependency check ────────────────────────────────────────────────────
try {
  const cwdPkg = JSON.parse(fs.readFileSync(cwdPkgPath, 'utf-8'));
  const hasDrizzle =
    cwdPkg.dependencies?.['drizzle-orm'] ||
    cwdPkg.devDependencies?.['drizzle-orm'];
  if (!hasDrizzle) {
    console.warn(
      '\n⚠️  Crudora: drizzle-orm is not listed in your dependencies.\n' +
      '   Run: npm install drizzle-orm\n' +
      '   Also install the driver for your database:\n' +
      '     PostgreSQL: npm install pg\n' +
      '     MySQL:      npm install mysql2\n',
    );
  }
} catch {
  // Non-fatal — package.json may not be JSON-parseable
}

const templateDir = path.join(__dirname, '..', 'templates');
const targetEnvPath = path.join(process.cwd(), '.env');
const targetServerPath = path.join(process.cwd(), 'src', 'server.ts');
const targetDrizzleConfig = path.join(process.cwd(), 'drizzle.config.ts');
const targetSchemaDir = path.join(process.cwd(), 'src', 'db');
const targetSchemaPath = path.join(targetSchemaDir, 'schema.ts');

console.log('🚀 Setting up Crudora project...');

// 1. Create .env file
if (!fs.existsSync(targetEnvPath)) {
  console.log('🔧 Creating .env file...');
  const envContent = `# Database — choose one based on your dialect
# PostgreSQL
DATABASE_URL="postgresql://user:password@localhost:5432/mydb"

# MySQL (uncomment if using MySQL)
# DATABASE_URL="mysql://user:password@localhost:3306/mydb"

# Server
PORT=3000
NODE_ENV=development

# API
API_BASE_PATH="/api"
`;
  fs.writeFileSync(targetEnvPath, envContent);
  console.log('✅ .env file created');
} else {
  console.log('🔧 .env file already exists, skipping creation');
}

// 2. Create drizzle.config.ts
if (!fs.existsSync(targetDrizzleConfig)) {
  console.log('📋 Creating drizzle.config.ts...');
  fs.copyFileSync(path.join(templateDir, 'drizzle.config.ts'), targetDrizzleConfig);
  console.log('✅ drizzle.config.ts created');
} else {
  console.log('📋 drizzle.config.ts already exists, skipping');
}

// 3. Create src/db/schema.ts
if (!fs.existsSync(targetSchemaPath)) {
  console.log('📋 Creating src/db/schema.ts...');
  if (!fs.existsSync(targetSchemaDir)) {
    fs.mkdirSync(targetSchemaDir, { recursive: true });
  }
  fs.copyFileSync(path.join(templateDir, 'schema.ts'), targetSchemaPath);
  console.log('✅ src/db/schema.ts created');
} else {
  console.log('📋 src/db/schema.ts already exists, skipping');
}

// 4. Create basic server setup
if (!fs.existsSync(targetServerPath)) {
  console.log('🖥️  Creating server setup...');
  const serverContent = `import { CrudoraServer, Model, Field } from 'crudora';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

// Example User model (uncomment and modify as needed)
/*
class User extends Model {
  static schema = 'auth';           // optional: database schema
  static tableName = 'users';
  static hidden = ['password'];

  @Field({ type: 'uuid', primary: true })
  id!: string;

  @Field({ type: 'string', required: true, unique: true })
  email!: string;

  @Field({ type: 'string', required: true })
  password!: string;
}
*/

const server = new CrudoraServer({
  port: Number(process.env.PORT) || 3000,
  db,
  dialect: 'postgresql',
  cors: true,
  basePath: process.env.API_BASE_PATH || '/api',
});

// Register your models here
// server.registerModel(User);

server.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date() } });
});

server
  .generateRoutes()
  .listen(() => {
    console.log('🚀 Crudora server is running!');
  });
`;
  if (!fs.existsSync(path.dirname(targetServerPath))) {
    fs.mkdirSync(path.dirname(targetServerPath), { recursive: true });
  }
  fs.writeFileSync(targetServerPath, serverContent);
  console.log('✅ Server setup created at src/server.ts');
} else {
  console.log('🖥️  src/server.ts already exists, skipping creation');
}

console.log('\n🎉 Crudora setup complete!');
console.log('\n📝 Next steps:');
console.log('1. Install dependencies: npm install drizzle-orm pg');
console.log('2. Update DATABASE_URL in .env');
console.log('3. Define your models in src/server.ts');
console.log('4. Add these scripts to your package.json:');
console.log('   "dev":          "ts-node src/server.ts"');
console.log('   "build":        "tsc"');
console.log('   "db:generate":  "drizzle-kit generate"');
console.log('   "db:push":      "drizzle-kit push"');
console.log('   "db:migrate":   "drizzle-kit migrate"');
console.log('   "db:studio":    "drizzle-kit studio"');
console.log('5. Push schema to DB: npx drizzle-kit push');
console.log('6. Start server: npx ts-node src/server.ts');
console.log('\n📖 Documentation: https://github.com/suryamsj/crudora#readme');
