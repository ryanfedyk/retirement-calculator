
import puppeteer from 'puppeteer';

async function scrapePrice() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // Try Google Finance first as it's the "Googiest" source
    await page.goto('https://www.google.com/finance/quote/GOOG:NASDAQ', { waitUntil: 'domcontentloaded' });

    // Selector for the big price number on Google Finance
    // Usually class "YMlKec fxKbKc" or similar. We can try a few.
    const priceElement = await page.$('.YMlKec.fxKbKc');

    if (priceElement) {
      const text = await page.evaluate(el => el.textContent, priceElement);
      console.log(`GOOG Price (Google Finance): ${text}`);
    } else {
      console.log('Could not find price element on Google Finance');
    }

  } catch (err) {
    console.error('Error scraping:', err);
  } finally {
    await browser.close();
  }
}

scrapePrice();
