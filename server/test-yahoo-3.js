"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const yahoo_finance2_1 = __importDefault(require("yahoo-finance2"));
const yf = new yahoo_finance2_1.default();
async function test() {
    try {
        const result = await yf.quote('GOOG');
        console.log("Keys returned:", Object.keys(result));
        console.log("regularMarketPrice:", result.regularMarketPrice);
        console.log("postMarketPrice:", result.postMarketPrice);
        console.log("marketState:", result.marketState);
    }
    catch (err) {
        console.error(err);
    }
}
test();
