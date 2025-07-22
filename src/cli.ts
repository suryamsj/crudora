// Ubah semua import menjadi require
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';


function initProject() {
  const templatePath = path.join(__dirname, '..', 'templates', 'schema.prisma');
  const targetPrismaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
  const targetEnvPath = path.join(process.cwd(), '.env');
  const targetServerPath = path.join(process.cwd(), 'src', 'server.ts'); // Ubah ke .ts

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
    const envContent = fs.readFileSync(
      path.join(__dirname, '..', 'templates', '.env.example'),
      'utf8'
    );
    fs.writeFileSync(targetEnvPath, envContent);
    console.log('✅ .env file created');
  } else {
    console.log('🔧 .env file already exists, skipping creation');
  }

  // 3. Create basic server setup with TypeScript and ESM
  if (!fs.existsSync(targetServerPath)) {
    console.log('🖥️  Creating server setup...');
    const serverContent = `import { CrudoraServer } from 'crudora';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

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
  port: Number(process.env.PORT) || 3000,
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
    console.log('📚 API documentation: http://localhost:\${process.env.PORT || 3000}\${process.env.API_BASE_PATH || '/api'}');
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
        'dev': 'ts-node server.ts',
        'start': 'ts-node server.ts',
        'build': 'tsc',
        'start:prod': 'node dist/server.js',
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
      console.log('⚠️  Could not update package.json scripts:', (error as Error).message);
    }
  }

  // 5. Create tsconfig.json if it doesn't exist
  const targetTsConfigPath = path.join(process.cwd(), 'tsconfig.json');
  if (!fs.existsSync(targetTsConfigPath)) {
    console.log('📝 Creating tsconfig.json...');
    const tsConfigContent = {
      "compilerOptions": {
        "target": "ES2020",
        "module": "NodeNext",
        "moduleResolution": "NodeNext",
        "lib": ["ES2020"],
        "outDir": "./dist",
        "rootDir": "./",
        "strict": true,
        "esModuleInterop": true,
        "skipLibCheck": true,
        "forceConsistentCasingInFileNames": true,
        "experimentalDecorators": true,
        "emitDecoratorMetadata": true,
        "resolveJsonModule": true,
        "declaration": true,
        "sourceMap": true
      },
      "include": ["*.ts", "src/**/*"],
      "exclude": ["node_modules", "dist", "**/*.test.ts"]
    };
    fs.writeFileSync(targetTsConfigPath, JSON.stringify(tsConfigContent, null, 2));
    console.log('✅ tsconfig.json created');
  }

  console.log('\n🎉 Crudora setup complete!');
  console.log('\n📝 Next steps:');
  console.log('1. Install dependencies: npm install @prisma/client prisma dotenv ts-node typescript');
  console.log('2. Generate Prisma client: npx prisma generate');
  console.log('3. Push database schema: npx prisma db push');
  console.log('4. Define your models in server.ts');
  console.log('5. Start development server: npm run dev');
  console.log('\n📖 Documentation: https://github.com/suryamsj/crudora#readme');
}

function runPrismaStudio() {
  console.log('🚀 Starting Prisma Studio...');
  try {
    execSync('npx prisma studio', { stdio: 'inherit' });
  } catch (error) {
    console.error('❌ Failed to start Prisma Studio:', (error as Error).message);
    process.exit(1);
  }
}

function generatePrismaClient() {
  console.log('🔧 Generating Prisma Client...');
  try {
    execSync('npx prisma generate', { stdio: 'inherit' });
    console.log('✅ Prisma Client generated successfully');
  } catch (error) {
    console.error('❌ Failed to generate Prisma Client:', (error as Error).message);
    process.exit(1);
  }
}

function pushPrismaSchema() {
  console.log('🔄 Pushing Prisma schema to database...');
  try {
    execSync('npx prisma db push', { stdio: 'inherit' });
    console.log('✅ Schema pushed to database successfully');
  } catch (error) {
    console.error('❌ Failed to push schema to database:', (error as Error).message);
    process.exit(1);
  }
}

function migratePrismaSchema() {
  console.log('🔄 Running Prisma migrations...');
  try {
    execSync('npx prisma migrate dev', { stdio: 'inherit' });
    console.log('✅ Migrations completed successfully');
  } catch (error) {
    console.error('❌ Failed to run migrations:', (error as Error).message);
    process.exit(1);
  }
}

// Membuat CLI program
const program = new Command();

program
  .name('crudora')
  .description('CLI for Crudora - TypeScript framework for automated CRUD API generation')
  .version('0.1.0-alpha.3');

program
  .command('init')
  .description('Initialize a new Crudora project')
  .action(initProject);

program
  .command('studio')
  .description('Start Prisma Studio')
  .action(runPrismaStudio);

program
  .command('generate')
  .description('Generate Prisma Client')
  .action(generatePrismaClient);

program
  .command('push')
  .description('Push Prisma schema to database')
  .action(pushPrismaSchema);

program
  .command('migrate')
  .description('Run Prisma migrations')
  .action(migratePrismaSchema);

program.parse();

// Di akhir file, ubah export jika ada
module.exports = {
  initProject,
  runPrismaStudio,
  generatePrismaClient,
  pushPrismaSchema,
  migratePrismaSchema
};
