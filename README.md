# Buffer Schedule Sync

This script synchronizes posting schedules across all your Buffer social media channels to match your Twitter schedule. It uses Playwright to automate the process through Buffer's web interface.

## Prerequisites

- Node.js (v16 or higher)
- npm (comes with Node.js)
- A Buffer account with multiple social media channels connected
- Twitter must be one of your connected channels

## Installation

1. Clone this repository:
```bash
git clone https://github.com/yourusername/buffer-sync.git
cd buffer-sync
```

2. Install dependencies:
```bash
npm install playwright
```

## Usage

1. Run the script:
```bash
node index.js
```

2. A browser window will open automatically for the Buffer web site. Log in to your Buffer account in this window, including any two-factor authentication.


3. Return to the terminal and press ENTER to continue

4. The script will:
   - Find your Twitter channel
   - Read its current posting schedule
   - For each other channel:
     - Clear existing schedule (if any)
     - Add new posting times to match Twitter's schedule
   - Automatically close when complete

## How It Works

1. The script opens Buffer's web interface
2. Waits for you to log in and handle 2FA
3. Identifies all connected channels
4. Uses Twitter's schedule as the template
5. Synchronizes all other channels to match Twitter's schedule exactly

## Troubleshooting

If you encounter any issues:

1. **Login Issues**
   - Make sure you complete the login process
   - Handle 2FA if enabled
   - Press ENTER only after fully logged in

2. **Schedule Sync Issues**
   - Ensure Twitter is connected to your Buffer account
   - Check that you have posting permissions for all channels
   - Verify your Buffer account is active and in good standing

3. **Script Errors**
   - Make sure you have the latest version of Node.js
   - Try reinstalling dependencies: `npm install`
   - Check that Playwright is properly installed

## Notes

- The script requires manual intervention for login/2FA
- It will not modify your Twitter schedule
- All other channels will be updated to match Twitter's schedule exactly
- Existing schedules on other channels will be cleared before syncing

## License

MIT License 