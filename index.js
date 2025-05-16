// sync-buffer-schedule.js
// Run with: node sync-buffer-schedule.js
// Requires Playwright: npm install playwright

const { chromium } = require('playwright');
const readline = require('readline');

(async () => {
  // 1. Launch headed browser and open Buffer
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://publish.buffer.com');

  // 2. Pause for you to log in (including 2FA), then press ENTER here
  console.log('Please log in to Buffer in the opened browser.');
  console.log('When done, return here and press ENTER to continue...');
  await waitForEnter();

  // 3. Wait for channel sidebar to load
  await page.waitForSelector('[data-sidebar="list"] [data-sidebar="item"]');

  // 4. Read all channels from sidebar
  const channels = await page.$$eval(
    '[data-sidebar="list"] [data-sidebar="item"] a[href^="/channels/"]',
    links => links.map(a => ({
      name: a.querySelector('[data-testid="channel-name"]')?.innerText.trim() || a.innerText.trim(),
      href: a.href,
      type: a.querySelector('[data-channel]')?.getAttribute('data-channel')
    }))
  );

  // 5. Identify Twitter channel
  const twitter = channels.find(c => c.type === 'twitter');
  if (!twitter) {
    console.error('Twitter channel not found in your Buffer accounts.');
    await browser.close();
    process.exit(1);
  }
  const others = channels.filter(c => c !== twitter);

  // 6. Extract Twitter schedule slots
  await page.goto(`${twitter.href}/settings`);
  await page.waitForSelector('[data-testid="posting-schedule-column"]');
  
  const slots = await page.evaluate(() => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const schedule = {};
    
    // For each day column
    document.querySelectorAll('[data-testid="posting-schedule-column"]').forEach((column, index) => {
      const day = days[index];
      const isEnabled = column.getAttribute('data-disabled') !== 'true';
      
      if (isEnabled) {
        // Find all time slots in this column
        const times = Array.from(column.querySelectorAll('.publish_cell_Pv51k')).map(cell => {
          const buttons = cell.querySelectorAll('button');
          // Only take the first 3 buttons (hour, minute, meridiem)
          const timeButtons = Array.from(buttons).slice(0, 3);
          const [hour, minute, meridiem] = timeButtons.map(b => b.textContent.trim());
          return `${hour}:${minute} ${meridiem}`;
        });
        schedule[day] = times;
      } else {
        schedule[day] = [];
      }
    });
    
    return schedule;
  });

  // 7. Sync each non‑Twitter channel
  for (const ch of others) {
    console.log(`Syncing ${ch.name}...`);
    await page.goto(`${ch.href}/settings`);
    await page.waitForSelector('[data-testid="posting-schedule-column"]');

    // 7a. Check for and clear any existing schedule before adding new times
    const hasExistingSchedule = await page.$eval(
      '[data-testid="posting-schedule-empty-state"]',
      el => !el
    ).catch(() => true); // If we can't find empty state, assume there is a schedule

    if (hasExistingSchedule) {
      try {
        // First try to remove the interfering help widget
        await page.evaluate(() => {
          const helpButton = document.querySelector('.brainfish-trigger-button');
          if (helpButton) helpButton.remove();
        });
        
        // Try to click the clear all button with force if needed
        await Promise.race([
          page.click('[data-testid="posting-schedule-clear-all-trigger"]', { force: true }),
          page.click('[data-testid="posting-schedule-clear-all-trigger"]')
        ]);

        // Wait for the confirmation dialog and click Clear
        await page.waitForSelector('[role="alertdialog"]', { timeout: 5000 });
        await page.click('[data-testid="posting-schedule-clear-all-confirm"]', { force: true });
        
        // Wait for the dialog to close and schedule to clear
        await page.waitForTimeout(2000);

        // Verify the schedule is actually cleared
        const isCleared = await page.$eval(
          '[data-testid="posting-schedule-empty-state"]',
          el => true
        ).catch(() => false);

        if (!isCleared) {
          throw new Error('Failed to clear schedule - empty state not detected');
        }
      } catch (error) {
        console.error(`Failed to clear schedule for ${ch.name}:`, error.message);
        console.log('Skipping this channel due to clear failure');
        continue; // Skip to next channel if we couldn't clear
      }
    }

    // 7b. Now that we're sure the schedule is clear, add new times
    for (const [day, times] of Object.entries(slots)) {
      if (times.length === 0) continue;

      for (const time of times) {
        try {
          // Click the add time button in the schedule header
          await page.click('button:has-text("Add posting time")');
          await page.waitForTimeout(500);

          // Set the day
          await page.click('[data-testid="postingtime-form-days-selector"]');
          await page.waitForTimeout(200);
          await page.click(`[role="menuitem"]:has-text("${day}")`);
          await page.waitForTimeout(200);

          // Parse the time
          const [rawTime, meridiem] = time.split(' ');
          const [hour, minute] = rawTime.split(':');

          // Set the hour
          await page.click('[data-testid="postingtime-form-hours-selector"]');
          await page.waitForTimeout(200);
          await page.click(`[role="menuitem"]:has-text("${hour}")`);
          await page.waitForTimeout(200);

          // Set the minute
          await page.click('[data-testid="postingtime-form-minutes-selector"]');
          await page.waitForTimeout(200);
          await page.click(`[role="menuitem"]:has-text("${minute}")`);
          await page.waitForTimeout(200);

          // Set AM/PM
          await page.click('[data-testid="postingtime-form-am-pm-selector"]');
          await page.waitForTimeout(200);
          await page.click(`[role="menuitem"]:has-text("${meridiem}")`);
          await page.waitForTimeout(200);

          // Add the time
          await page.click('[data-testid="postingtime-form-submit-button"]');
          await page.waitForTimeout(500);
        } catch (error) {
          console.error(`Failed to add time ${time} for ${day}:`, error.message);
          continue;
        }
      }
    }

    console.log(`Finished syncing schedule for ${ch.name}`);
    await page.waitForTimeout(1000); // Give UI time to settle before next channel
  }

  console.log('All channels synced to match Twitter schedule.');
  await browser.close();
})();

// Helper: wait for ENTER in console
function waitForEnter() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question('', () => { rl.close(); resolve(); }));
}

// Helper: parse "9:30 AM" → { hour: 9, minute: 30, meridiem: "AM" }
function parseTime(str) {
  const [time, meridiem] = str.split(' ');
  let [hour, minute] = time.split(':').map(n => parseInt(n, 10));
  return { hour, minute, meridiem };
}