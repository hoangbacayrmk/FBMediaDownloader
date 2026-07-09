import fetch from "node-fetch";
import fs from "fs";
import { log } from "./logger.js";

export const sleep = (ms) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

export const checkFileExist = (fileDir) => fs.existsSync(fileDir);

export const deleteFile = (fileDir) =>
  checkFileExist(fileDir) && fs.unlinkSync(fileDir);

export const createIfNotExistDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log("INFO", `> Đã tạo thư mục ${dir}.`);
  }
};

export const saveToFile = (fileName, data, override = false) => {
  try {
    fs.writeFileSync(fileName, data, { flag: override ? "w+" : "a+" });
    log("INFO", `> Đã lưu vào file ${fileName}`);
  } catch (err) {
    log("ERROR", "[!] ERROR: ", err.message);
  }
};

/**
 * Tải file từ URL bằng stream (không buffer toàn bộ vào RAM).
 * Có retry logic với exponential backoff.
 *
 * @param {string} url - URL cần tải.
 * @param {string} destination - Đường dẫn file đích.
 * @param {number} [maxRetries=3] - Số lần retry tối đa.
 * @returns {Promise<boolean>}
 */
export const download = async (url, destination, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      const totalBytes = parseInt(response.headers.get("content-length"), 10) || 0;
      const fileStream = fs.createWriteStream(destination);
      let downloadedBytes = 0;
      let lastProgress = -1;

      // Stream chunks vào file (thay vì buffer toàn bộ vào RAM)
      for await (const chunk of response.body) {
        fileStream.write(chunk);
        downloadedBytes += chunk.length;

        // Hiển thị progress bar (mỗi 5%)
        if (totalBytes > 0) {
          const pct = Math.round((downloadedBytes / totalBytes) * 100);
          if (pct !== lastProgress && pct % 5 === 0) {
            const bar = "█".repeat(Math.round(pct / 5)) + "░".repeat(20 - Math.round(pct / 5));
            const sizeMB = (downloadedBytes / 1024 / 1024).toFixed(1);
            const totalMB = (totalBytes / 1024 / 1024).toFixed(1);
            process.stdout.write(`\r⬇️  [${bar}] ${pct}% (${sizeMB}/${totalMB} MB)`);
            lastProgress = pct;
          }
        } else {
          // Không biết tổng size → hiện bytes đã tải
          const sizeMB = (downloadedBytes / 1024 / 1024).toFixed(1);
          process.stdout.write(`\r⬇️  Đang tải: ${sizeMB} MB...`);
        }
      }

      // Đóng stream
      await new Promise((resolve, reject) => {
        fileStream.end();
        fileStream.on("finish", resolve);
        fileStream.on("error", reject);
      });

      process.stdout.write("\n");

      // Kiểm tra file quá nhỏ (< 10KB) → có thể là file lỗi
      if (downloadedBytes < 10240 && url.includes("fbcdn.net")) {
        // Xóa file lỗi
        if (fs.existsSync(destination)) fs.unlinkSync(destination);
        throw new Error(`File quá nhỏ (${downloadedBytes} bytes) — có thể là DASH fragment hoặc file lỗi.`);
      }

      const finalMB = (downloadedBytes / 1024 / 1024).toFixed(1);
      log("INFO", `✅ Đã tải xong: ${finalMB} MB → ${destination}`);
      return true;

    } catch (err) {
      // Xóa file partial nếu có
      if (fs.existsSync(destination)) {
        try { fs.unlinkSync(destination); } catch {}
      }

      if (attempt < maxRetries) {
        const delay = 1000 * Math.pow(2, attempt); // 2s, 4s, 8s
        log("WARN", `⚠️ Tải thất bại (lần ${attempt}/${maxRetries}): ${err.message}`);
        log("WARN", `   ↻ Thử lại sau ${delay / 1000}s...`);
        await sleep(delay);
      } else {
        log("ERROR", `❌ Tải thất bại sau ${maxRetries} lần thử: ${err.message}`);
        throw err;
      }
    }
  }
};
