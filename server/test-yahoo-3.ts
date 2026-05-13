import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance();

async function test() {
  try {
    const result = await yf.quote('GOOG');
    console.log("Keys returned:", Object.keys(result));
    console.log("regularMarketPrice:", result.regularMarketPrice);
    console.log("postMarketPrice:", result.postMarketPrice);
    console.log("marketState:", result.marketState);
  } catch (err) {
    console.error(err);
  }
}

test();
