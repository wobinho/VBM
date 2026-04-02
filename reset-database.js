#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const dbFiles = [
  path.join(__dirname, 'spike-dynasty.db'),
  path.join(__dirname, 'spike-dynasty.db-shm'),
  path.join(__dirname, 'spike-dynasty.db-wal'),
];

let deletedCount = 0;
dbFiles.forEach(file => {
  try {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      console.log(`✓ Deleted ${path.basename(file)}`);
      deletedCount++;
    }
  } catch (err) {
    console.warn(`⚠ Could not delete ${path.basename(file)}: ${err.message}`);
  }
});

if (deletedCount > 0) {
  console.log(`\n✓ Database reset! The new schema will be created on next app start.`);
} else {
  console.log('ℹ No database files found to delete.');
}
