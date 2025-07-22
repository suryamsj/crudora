const fs = require('fs');
const path = require('path');

const templatePath = path.join(__dirname, '..', 'templates', 'schema.prisma');
const targetPath = path.join(process.cwd(), 'prisma', 'schema.prisma');

// Only copy if prisma directory doesn't exist
if (!fs.existsSync(path.dirname(targetPath))) {
  console.log('📋 Creating default Prisma schema...');
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(templatePath, targetPath);
  console.log('✅ Default schema.prisma created in prisma/schema.prisma');
  console.log('🔧 Don\'t forget to set your DATABASE_URL in .env file');
}