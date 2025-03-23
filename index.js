const { chromium } = require("playwright");
const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();
const port = 3000;

const log = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  error: (msg) => console.error(`[ERROR] ${msg}`)
};

// Helper function to find available Chromium path
function findChromiumPath() {
  try {
    // Base directory where Playwright stores browsers
    const basePath = path.join(process.env.HOME || '/home/codespace', '.cache/ms-playwright');

    // Check if the base directory exists
    if (!fs.existsSync(basePath)) return null;

    // List all directories and find ones that start with 'chromium-'
    const chromiumVersions = fs.readdirSync(basePath)
      .filter(dir => dir.startsWith('chromium-'))
      .map(dir => ({
        version: parseInt(dir.replace('chromium-', ''), 10),
        path: path.join(basePath, dir, 'chrome-linux', 'chrome')
      }))
      .filter(item => fs.existsSync(item.path))
      .sort((a, b) => b.version - a.version); // Sort by version in descending order

    // Return the path to the highest version, if any
    return chromiumVersions.length > 0 ? chromiumVersions[0].path : null;
  } catch (error) {
    console.error('Error finding Chromium path:', error);
    return null;
  }
}

app.use(express.json());
app.use(express.static("public")); // Serve front-end files

async function sortHackerNewsArticles(articleCount) {
  const logs = [];
  const logAndStore = (type, msg) => {
    const entry = `[${type}] ${msg}`;
    logs.push(entry);
    log[type.toLowerCase()](msg);
  };

  //const browser = await chromium.launch({ headless: false });
  /*const browser = await chromium.launch({ 
    headless: true,
    executablePath: '/home/codespace/.cache/ms-playwright/chromium-1084/chrome-linux/chrome' 
  });*/
  // Find Chromium path dynamically
  const chromiumPath = findChromiumPath();
  if (chromiumPath) {
    logAndStore("INFO", `Using Chromium at: ${chromiumPath}`);
  } else {
    logAndStore("INFO", "No custom Chromium path found, using default");
  }

  const browser = await chromium.launch({
    headless: true,
    executablePath: chromiumPath || undefined
  });
  const page = await browser.newContext().then(c => c.newPage());

  try {
    let timestamps = [];
    let pageNum = 1;

    logAndStore("INFO", `Collecting ${articleCount} articles...`);
    while (timestamps.length < articleCount) {
      await page.goto(pageNum === 1 ? "https://news.ycombinator.com/newest" : `https://news.ycombinator.com/newest?p=${pageNum}`);
      const pageTimestamps = await page.evaluate(() =>
        Array.from(document.querySelectorAll(".athing")).map(row =>
          row.nextElementSibling?.querySelector(".age")?.getAttribute("title")
        )
      );
      logAndStore("INFO", `Page ${pageNum}: ${pageTimestamps.length} articles`);
      timestamps = [...timestamps, ...pageTimestamps];
      pageNum++;
    }

    timestamps = timestamps.slice(0, articleCount);
    if (timestamps.length !== articleCount) throw new Error(`Not enough articles (found ${timestamps.length})`);

    const dates = timestamps.map(ts => new Date(ts));
    let isSorted = true;
    for (let i = 1; i < dates.length; i++) {
      if (dates[i] > dates[i - 1]) {
        logAndStore("ERROR", `Sorting failed at position ${i}`);
        isSorted = false;
        break;
      }
    }

    logAndStore("INFO", isSorted ? `Success: ${articleCount} articles sorted newest to oldest` : "Failure: Not sorted");

    return logs;

  } catch (error) {
    logAndStore("ERROR", `${error.message}`);
    return logs;
  } finally {
    await browser.close();
    logAndStore("INFO", "Browser closed");
  }
}

app.post("/run", async (req, res) => {
  const { articleCount } = req.body;
  const logs = await sortHackerNewsArticles(parseInt(articleCount) || 100);
  res.json({ logs });
});

app.listen(port, () => {
  log.info(`Server running at http://localhost:${port}`);
});

/*


*/