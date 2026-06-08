import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });


/**
 * Rewriter Module
 * Handles AI-powered text rewriting for video captions using Google Gemini.
 */

export const rewriteCaption = async (originalText, style = "viral") => {
  if (!originalText || originalText.trim().length < 5) return originalText;

  console.log(`✍️ Đang viết lại caption bằng Gemini AI (Style: ${style})...`);

  try {
    const prompt = `Viết lại nội dung sau đây theo phong cách ${style} cho video Reels. 
    Yêu cầu:
    1. BẮT BUỘC phải dịch và viết nội dung hoàn toàn bằng Tiếng Việt 100%, dù nội dung gốc là tiếng nước ngoài.
    2. Giữ nguyên ý chính nhưng làm cho hấp dẫn, viral hơn.
    3. Thêm các emoji phù hợp.
    4. Thêm các hashtag liên quan ở cuối.
    5. Chỉ trả về nội dung đã viết lại, không thêm lời giải thích hay ngoặc kép.

    Nội dung gốc: ${originalText}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error("❌ Lỗi khi gọi Gemini API:", error);
    // Fallback logic

    const hashtags = [" #reels", " #trending", " #viral", " #xuhuong"];
    return `🔥 ${originalText} 🔥\n\n${hashtags.sort(() => 0.5 - Math.random()).join("")}`;
  }
};
