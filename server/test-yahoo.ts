import yahooFinance from 'yahoo-finance2';

async function test() {
  try {
    const result = await yahooFinance.quote('GOOG');
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(err);
  }
}

test();
