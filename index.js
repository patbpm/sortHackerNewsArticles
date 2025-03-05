const { chromium } = require("playwright");
const express = require("express");
const app = express();
const port = 3000;

const log = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  error: (msg) => console.error(`[ERROR] ${msg}`)
};

app.use(express.json());
app.use(express.static("public")); // Serve front-end files

async function sortHackerNewsArticles(articleCount) {
  const logs = [];
  const logAndStore = (type, msg) => {
    const entry = `[${type}] ${msg}`;
    logs.push(entry);
    log[type.toLowerCase()](msg);
  };

  const browser = await chromium.launch({ headless: false });
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