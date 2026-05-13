"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const yahoo_finance2_1 = __importDefault(require("yahoo-finance2"));
async function test() {
    try {
        const result = await yahoo_finance2_1.default.quote('GOOG');
        console.log(JSON.stringify(result, null, 2));
    }
    catch (err) {
        console.error(err);
    }
}
test();
