"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const generative_ai_1 = require("@google/generative-ai");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
async function run() {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    try {
        const result = await model.generateContent("Hello");
        console.log("Success with gemini-1.5-pro", result.response.text());
    }
    catch (e) {
        console.log("Error gemini-1.5-pro", e.message);
    }
    const model3 = genAI.getGenerativeModel({ model: 'gemini-pro' });
    try {
        const result = await model3.generateContent("Hello");
        console.log("Success with gemini-pro", result.response.text());
    }
    catch (e) {
        console.log("Error gemini-pro", e.message);
    }
}
run();
