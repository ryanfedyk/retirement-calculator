import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

async function run() {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
  try {
    const result = await model.generateContent("Hello");
    console.log("Success with gemini-1.5-pro", result.response.text());
  } catch (e: any) {
    console.log("Error gemini-1.5-pro", e.message);
  }

  const model3 = genAI.getGenerativeModel({ model: 'gemini-pro' });
  try {
    const result = await model3.generateContent("Hello");
    console.log("Success with gemini-pro", result.response.text());
  } catch (e: any) {
    console.log("Error gemini-pro", e.message);
  }
}

run();
