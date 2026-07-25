import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import ffmpegInstaller from "ffmpeg-static";
import ffprobeInstaller from "ffprobe-static";
import ffmpeg from "fluent-ffmpeg";
import { log } from "./logger.js";
import { createIfNotExistDir } from "./utils.js";

ffmpeg.setFfmpegPath(ffmpegInstaller);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

const YTDLP_PATH = path.join("./bin", "yt-dlp.exe");
const COOKIES_DIR = "./downloads/.cookies";

/**
 * Xuất cookie của phiên Puppeteer đang đăng nhập ra file dạng Netscape,
 * để yt-dlp dùng lại được phiên đăng nhập đó (truy cập được luồng HD/riêng tư).
 * @param {import('puppeteer').Page} page
 * @returns {Promise<string>} đường dẫn file cookies.txt
 */
export async function exportCookiesForYtDlp(page) {
  createIfNotExistDir(COOKIES_DIR);
  const cookies = await page.cookies();
  const cookiesFile = path.join(COOKIES_DIR, "fb_cookies.txt");

  const lines = ["# Netscape HTTP Cookie File"];
  for (const c of cookies) {
    const domain = c.domain.startsWith(".") ? c.domain : `.${c.domain}`;
    const includeSubdomains = "TRUE";
    const pathVal = c.path || "/";
    const secure = c.secure ? "TRUE" : "FALSE";
    const expires = c.expires && c.expires > 0 ? Math.floor(c.expires) : 0;
    lines.push([domain, includeSubdomains, pathVal, secure, expires, c.name, c.value].join("\t"));
  }

  fs.writeFileSync(cookiesFile, lines.join("\n") + "\n");
  return cookiesFile;
}

/**
 * Tải video bằng yt-dlp với chất lượng cao nhất có thể (bestvideo+bestaudio).
 * yt-dlp tự xử lý luồng DASH (video/audio tách rời) và merge lại bằng ffmpeg.
 * @param {string} url - Link bài viết/reel Facebook gốc (không phải link video đã scrape).
 * @param {string} outputPath - Đường dẫn file .mp4 đích.
 * @param {string} [cookiesFile] - File cookies.txt (Netscape format) để truy cập nội dung cần đăng nhập.
 * @returns {Promise<boolean>}
 */
export async function downloadVideoWithYtDlp(url, outputPath, cookiesFile) {
  return new Promise((resolve) => {
    if (!fs.existsSync(YTDLP_PATH)) {
      log("WARN", "⚠️ Không tìm thấy yt-dlp.exe, bỏ qua tải HD qua yt-dlp.");
      return resolve(false);
    }

    createIfNotExistDir(path.dirname(outputPath));

    const args = [
      "-f", "bestvideo*+bestaudio/best",
      "--merge-output-format", "mp4",
      "--ffmpeg-location", ffmpegInstaller,
      "--no-playlist",
      "-o", outputPath,
      url,
    ];

    if (cookiesFile && fs.existsSync(cookiesFile)) {
      args.unshift("--cookies", cookiesFile);
    }

    log("INFO", "⬇️ Đang tải video bản HD qua yt-dlp...");
    const ytdlp = spawn(YTDLP_PATH, args, { shell: false });

    let stderrOutput = "";
    ytdlp.stderr.on("data", (d) => { stderrOutput += d.toString(); });

    ytdlp.on("close", (code) => {
      if (code === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 10240) {
        resolve(true);
      } else {
        log("WARN", `⚠️ yt-dlp thất bại (code ${code}): ${stderrOutput.split("\n").slice(-3).join(" ")}`);
        if (fs.existsSync(outputPath)) { try { fs.unlinkSync(outputPath); } catch {} }
        resolve(false);
      }
    });
  });
}

/**
 * Lấy độ phân giải thực tế của video đã tải để xác nhận có đúng là HD không.
 * @param {string} videoPath
 * @returns {Promise<{width:number,height:number}|null>}
 */
export async function getResolution(videoPath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) return resolve(null);
      const stream = metadata.streams?.find((s) => s.width && s.height);
      resolve(stream ? { width: stream.width, height: stream.height } : null);
    });
  });
}
