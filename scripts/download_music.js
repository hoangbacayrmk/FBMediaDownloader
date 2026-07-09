import fs from "fs";
import path from "path";
import https from "https";
import { spawnSync } from "child_process";
import ffmpegInstaller from "ffmpeg-static";
import { log } from "./logger.js";
import { createIfNotExistDir } from "./utils.js";

const BIN_DIR = "./bin";
const MUSIC_DIR = "./assets/bg_music";
const YTDLP_URL = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe";
const YTDLP_PATH = path.join(BIN_DIR, "yt-dlp.exe");

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        return reject(new Error(`Tải file thất bại với mã lỗi: ${response.statusCode}`));
      }
      response.pipe(file);
      file.on("finish", () => {
        file.close(resolve);
      });
    }).on("error", (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

export async function ensureYtDlp() {
  createIfNotExistDir(BIN_DIR);
  if (!fs.existsSync(YTDLP_PATH)) {
    log("INFO", "⬇️ Chưa có yt-dlp.exe. Đang tải xuống (chỉ tải 1 lần đầu)...");
    try {
      await downloadFile(YTDLP_URL, YTDLP_PATH);
      log("INFO", "✅ Tải yt-dlp thành công! Đang chờ Windows quét file...");
      await new Promise(resolve => setTimeout(resolve, 3000)); // Chờ Windows Defender nhả file
    } catch (err) {
      log("ERROR", "❌ Lỗi tải yt-dlp: " + err.message);
      process.exit(1);
    }
  }
}

async function start() {
  createIfNotExistDir(MUSIC_DIR);
  await ensureYtDlp();

  // Mặc định tải playlist Nhạc NCS không bản quyền này nếu người dùng không nhập link
  const defaultUrl = "https://www.youtube.com/playlist?list=PLRBp0Fe2GpgnIh0AiYKh7o7HnYAej-5ph";
  const playlistUrl = process.argv[2] || defaultUrl;

  log("INFO", `🎵 Đang lấy nhạc từ: ${playlistUrl}`);
  log("INFO", `   Thư mục lưu trữ: ${MUSIC_DIR}`);
  log("INFO", "⏳ Quá trình này có thể mất vài phút tùy số lượng bài hát...");

  try {
    const ffmpegPath = ffmpegInstaller;
    // Tải audio, convert sang mp3, bỏ qua lỗi (để nếu 1 bài lỗi thì tải bài tiếp theo)
    spawnSync(YTDLP_PATH, [
      "-x",
      "--audio-format", "mp3",
      "--audio-quality", "0",
      "--ffmpeg-location", ffmpegPath,
      "-i", // ignore errors
      "-o", `${MUSIC_DIR}/%(title)s.%(ext)s`,
      playlistUrl
    ], { stdio: "inherit" });

    log("INFO", "🎉 HOÀN TẤT TẢI NHẠC! Các file mp3 đã được lưu trong assets/bg_music/");
  } catch (err) {
    log("ERROR", "❌ Lỗi trong quá trình tải nhạc: " + err.message);
  }
}

// Chỉ tự động start nếu được chạy trực tiếp từ CLI
if (process.argv[1] && process.argv[1].endsWith("download_music.js")) {
  start();
}
