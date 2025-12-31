/**
 * Reminder Worker Script
 * 
 * This script runs a cron job to check for due reminders.
 * Run this separately from your main Next.js server.
 * 
 * Usage:
 *   node scripts/reminder-worker.js
 * 
 * Or use PM2:
 *   pm2 start scripts/reminder-worker.js --name reminder-worker
 */

const cron = require('node-cron');

// Check if node-cron is installed
try {
  require.resolve('node-cron');
} catch (e) {
  console.error('node-cron is not installed. Install it with: npm install node-cron');
  process.exit(1);
}

const API_URL = process.env.API_URL || 'http://localhost:3000';
const ENDPOINT = `${API_URL}/api/reminders/check-due`;

console.log(`[Reminder Worker] Starting...`);
console.log(`[Reminder Worker] API URL: ${API_URL}`);
console.log(`[Reminder Worker] Endpoint: ${ENDPOINT}`);

// Run every minute
cron.schedule('* * * * *', async () => {
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`[Reminder Worker] Check completed: ${data.processed || 0} reminders processed`);
    } else {
      console.error(`[Reminder Worker] Check failed: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error(`[Reminder Worker] Error:`, error.message);
  }
});

console.log(`[Reminder Worker] Cron job scheduled (runs every minute)`);
console.log(`[Reminder Worker] Press Ctrl+C to stop`);

// Keep process alive
process.on('SIGINT', () => {
  console.log('\n[Reminder Worker] Stopping...');
  process.exit(0);
});




