import fs from 'fs';
import path from 'path';

// Paths
const templatePath = path.join(__dirname, '..', 'templates', 'schema.prisma');
const targetPrismaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
const targetEnvPath = path.join(process.cwd(), '.env');
const targetServerPath = path.join(process.cwd(), 'src', 'server.ts');
const targetPackagePath = path.join(process.cwd(), 'package.json');

console.log('🚀 Setting up Crudora project...');

// 1. Create prisma directory and schema
if (!fs.existsSync(path.dirname(targetPrismaPath))) {
  console.log('📋 Creating Prisma schema...');
  fs.mkdirSync(path.dirname(targetPrismaPath), { recursive: true });
  fs.copyFileSync(templatePath, targetPrismaPath);
  console.log('✅ Prisma schema created at prisma/schema.prisma');
} else {
  console.log('📋 Prisma directory already exists, skipping schema creation');
}

// 2. Create .env file
if (!fs.existsSync(targetEnvPath)) {
  console.log('🔧 Creating .env file...');
  const envContent = `# Database
DATABASE_URL="file:./dev.db"

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

// 3. Create basic server setup
if (!fs.existsSync(targetServerPath)) {
  console.log('🖥️  Creating server setup...');
  const serverContent = `const { CrudoraServer } = require('crudora');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

// Example User model (uncomment and modify as needed)
/*
class User {
  static tableName = 'users';
  static primaryKey = 'id';
  static timestamps = true;
  static fillable = ['name', 'email'];
  static hidden = ['password'];
}
*/

const server = new CrudoraServer({
  port: process.env.PORT || 3000,
  prisma: prisma,
  cors: true,
  basePath: process.env.API_BASE_PATH || '/api'
});

// Register your models here
// server.registerModel(User);

// Add custom routes if needed
server.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Generate routes and start server
server
  .generateRoutes()
  .listen(() => {
    console.log('🚀 Crudora server is running!');
    console.log(\`📚 API documentation: http://localhost:\${process.env.PORT || 3000}\${process.env.API_BASE_PATH || '/api'}\`);
  });
`;
  fs.writeFileSync(targetServerPath, serverContent);
  console.log('✅ Server setup created at server.ts');
} else {
  console.log('🖥️  server.ts already exists, skipping creation');
}

// 4. Update package.json scripts (if package.json exists)
if (fs.existsSync(targetPackagePath)) {
  try {
    const packageJson = JSON.parse(fs.readFileSync(targetPackagePath, 'utf8'));

    if (!packageJson.scripts) {
      packageJson.scripts = {};
    }

    // Add useful scripts if they don't exist
    const scriptsToAdd = {
      'dev': 'ts-node src/server.ts',
      'start': 'ts-node src/server.ts',
    };

    let scriptsAdded = false;
    for (const [scriptName, scriptCommand] of Object.entries(scriptsToAdd)) {
      if (!packageJson.scripts[scriptName]) {
        packageJson.scripts[scriptName] = scriptCommand;
        scriptsAdded = true;
      }
    }

    if (scriptsAdded) {
      fs.writeFileSync(targetPackagePath, JSON.stringify(packageJson, null, 2));
      console.log('✅ Package.json scripts updated');
    }
  } catch (error) {
    console.log('⚠️  Could not update package.json scripts:', error.message);
  }
}

console.log('\n🎉 Crudora setup complete!');
console.log('\n📝 Next steps:');
console.log('1. Install dependencies: npm install @prisma/client prisma dotenv');
console.log('2. Generate Prisma client: npm run db:generate');
console.log('3. Push database schema: npm run db:push');
console.log('4. Define your models in server.js');
console.log('5. Start development server: npm run dev');
console.log('\n📖 Documentation: https://github.com/suryamsj/crudora#readme');
