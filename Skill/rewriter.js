import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import { log } from "../scripts/logger.js";

dotenv.config();

/**
 * Rewriter Module
 * Handles AI-powered text rewriting for video captions using Google Gemini.
 * - Lazy-init model (không crash nếu chưa có key lúc import)
 * - Retry tự động khi bị Rate Limit (429)
 * - Timeout bảo vệ (30s)
 */

let model = null;

/**
 * Khởi tạo model Gemini (lazy — chỉ chạy khi gọi rewriteCaption lần đầu).
 */
function getModel() {
  if (!model) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "your_gemini_api_key_here") {
      throw new Error("GEMINI_API_KEY chưa được cấu hình trong .env");
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
  }
  return model;
}

/**
 * Tạo promise có timeout.
 */
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout sau ${ms / 1000}s`)), ms)
    ),
  ]);
}

/**
 * Viết lại caption bằng Gemini AI.
 * Tự retry 3 lần khi gặp lỗi 429 (Rate Limit) với exponential backoff.
 *
 * @param {string} originalText - Nội dung gốc cần viết lại.
 * @param {string} [style='viral'] - Phong cách viết lại.
 * @param {number} [maxRetries=3] - Số lần retry tối đa.
 * @returns {Promise<string>} Nội dung đã viết lại.
 */
export const rewriteCaption = async (originalText, style = "viral", maxRetries = 3) => {
  if (!originalText || originalText.trim().length < 5) return originalText;

  log("INFO", `✍️ Đang viết lại caption bằng Gemini AI (Style: ${style})...`);

  const prompt = `Viết lại nội dung sau đây theo phong cách ${style} cho video Reels. 
    Yêu cầu:
    1. BẮT BUỘC phải dịch và viết nội dung hoàn toàn bằng Tiếng Việt 100%, dù nội dung gốc là tiếng nước ngoài.
    2. Giữ nguyên ý chính nhưng làm cho hấp dẫn, viral hơn.
    3. Thêm các emoji phù hợp.
    4. Thêm các hashtag liên quan ở cuối.
    5. Chỉ trả về nội dung đã viết lại, không thêm lời giải thích hay ngoặc kép.

    Nội dung gốc: ${originalText}`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const currentModel = getModel();
      const result = await withTimeout(
        currentModel.generateContent(prompt),
        30000 // Timeout 30s
      );
      const response = await result.response;
      const text = response.text().trim();

      if (!text || text.length < 3) {
        throw new Error("Gemini trả về nội dung rỗng");
      }

      log("INFO", `✅ Viết lại caption thành công (${text.length} ký tự)`);
      return text;
    } catch (error) {
      const isRateLimit = error.message?.includes("429") || error.message?.includes("RESOURCE_EXHAUSTED");
      const isTimeout = error.message?.includes("Timeout");

      if ((isRateLimit || isTimeout) && attempt < maxRetries) {
        const delay = 5000 * Math.pow(2, attempt - 1); // 5s, 10s, 20s
        log("WARN", `⚠️ ${isRateLimit ? "Rate Limit (429)" : "Timeout"} — thử lại sau ${delay / 1000}s (lần ${attempt}/${maxRetries})...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        log("ERROR", `❌ Lỗi Gemini API (lần ${attempt}/${maxRetries}):`, error.message || error);
        // Fallback: trả về bản gốc + thêm hashtags
        const hashtags = [" #reels", " #trending", " #viral", " #xuhuong"];
        return `🔥 ${originalText} 🔥\n\n${hashtags.sort(() => 0.5 - Math.random()).join("")}`;
      }
    }
  }
};
