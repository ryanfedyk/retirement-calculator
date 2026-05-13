
// @ts-nocheck
const { JSDOM } = require('jsdom');

async function testScrape() {
  try {
    const symbol = 'GOOG';
    const url = `https://www.google.com/finance/quote/${symbol}:NASDAQ`;

    console.log(`Fetching ${url}...`);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const html = await res.text();
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    // Class for the big price on Google Finance: .YMlKec.fxKbKc
    const priceEl = doc.querySelector('.YMlKec.fxKbKc');

    if (priceEl) {
      console.log(`GOOG Price: ${priceEl.textContent}`);
    } else {
      console.log('Price element not found. HTML length:', html.length);
      console.log('Page Title:', doc.title);
    }

  } catch (err) {
    console.error('Error:', err);
  }
}

testScrape();
