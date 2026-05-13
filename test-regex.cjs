const fs = require('fs');

const content = fs.readFileSync('My custom monthly budget - Assets & Expenditures (8).csv', 'utf8');

const parseNumber = (str) => {
  if (!str) return 0;
  return parseFloat(str.replace(/[\$,"]/g, '')) || 0;
};

let otherDebt = 0;

const facadeMatch = content.match(/Facade,"?\$?([\d,.]+)"?/);
if (facadeMatch) { console.log('Facade', facadeMatch[1]); otherDebt += parseNumber(facadeMatch[1]); }

const szeMatch = content.match(/Sze,"?\$?([\d,.]+)"?/);
if (szeMatch) { console.log('Sze', szeMatch[1]); otherDebt += parseNumber(szeMatch[1]); }

const aniketMatch = content.match(/Aniket,"?\$?([\d,.]+)"?/);
if (aniketMatch) { console.log('Aniket', aniketMatch[1]); otherDebt += parseNumber(aniketMatch[1]); }

const furnMatch = content.match(/Furniture,"?\$?([\d,.]+)"?/);
if (furnMatch) { console.log('Furniture', furnMatch[1]); otherDebt += parseNumber(furnMatch[1]); }

const banquetMatch = content.match(/banquet,"?\$?([\d,.]+)"?/);
if (banquetMatch) { console.log('banquet', banquetMatch[1]); otherDebt += parseNumber(banquetMatch[1]); }

const loanMatch = content.match(/Loan,,"?\$?([\d,.]+)"?/);
if (loanMatch) { console.log('Loan', loanMatch[1]); otherDebt += parseNumber(loanMatch[1]); }

console.log('Total other debt:', otherDebt);
