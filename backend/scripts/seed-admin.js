/**
 * Run once to create an admin user:
 *   node scripts/seed-admin.js
 */
require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const User = require('../src/models/User');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/dialect');
  console.log('Connected to MongoDB');

  const existing = await User.findOne({ role: 'admin' });
  if (existing) { console.log(`Admin already exists: ${existing.username}`); process.exit(0); }

  const admin = await User.create({
    username: 'admin',
    email: 'admin@dialect.local',
    password: 'Admin@1234',
    role: 'admin',
    mode: 'public',
    eloRating: 1000,
  });
  console.log(`✅ Admin created — username: admin  password: Admin@1234`);
  console.log(`   (Change this password immediately in production!)`);
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });