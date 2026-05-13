require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
async function test() {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-3.0-pro" });
    const result = await model.generateContent("Hello");
    console.log(result.response.text());
  } catch (e) {
    console.error("Error:", e.message);
  }
}
test();
