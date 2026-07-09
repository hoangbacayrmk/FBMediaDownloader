import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "ffmpeg-static";
import ffprobeInstaller from "ffprobe-static";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { log } from "../scripts/logger.js";

dotenv.config();

ffmpeg.setFfmpegPath(ffmpegInstaller);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

/**
 * Lấy thông tin metadata video (duration, codec, resolution...).
 */
const getVideoInfo = (inputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) reject(err);
      else resolve({
        duration: metadata.format.duration,
        size: metadata.format.size,
        bitrate: metadata.format.bit_rate,
        codec: metadata.streams?.[0]?.codec_name || "unknown",
        width: metadata.streams?.[0]?.width,
        height: metadata.streams?.[0]?.height,
      });
    });
  });
};

/**
 * Xử lý video: cắt đầu/cuối và tắt âm thanh.
 * @param {string} inputPath - Đường dẫn file video đầu vào.
 * @param {object} options
 * @param {number} [options.trimStart] - Số giây cắt đầu (mặc định từ .env hoặc 1).
 * @param {number} [options.trimEnd]   - Số giây cắt đuôi (mặc định từ .env hoặc 1).
 * @param {boolean} [options.deleteOriginal] - Xóa file gốc sau khi xử lý xong.
 * @param {boolean} [options.keepAudio]      - Giữ lại âm thanh (mặc định: tắt âm).
 */
export const processVideo = async (inputPath, options = {}) => {
  // Validate input file
  if (!fs.existsSync(inputPath)) {
    throw new Error(`File không tồn tại: ${inputPath}`);
  }

  const fileSize = fs.statSync(inputPath).size;
  if (fileSize < 1024) {
    throw new Error(`File quá nhỏ (${fileSize} bytes), có thể bị lỗi: ${inputPath}`);
  }

  try {
    const parsedPath = path.parse(inputPath);
    // Tên file mới sẽ có thêm hậu tố _cut để anh dễ phân biệt
    const outputPath = path.join(parsedPath.dir, `${parsedPath.name}_cut${parsedPath.ext}`);

    // Đọc giá trị mặc định từ .env, fallback về 1 giây
    const defaultTrimStart = parseFloat(process.env.DEFAULT_TRIM_START) || 1;
    const defaultTrimEnd = parseFloat(process.env.DEFAULT_TRIM_END) || 1;

    const videoInfo = await getVideoInfo(inputPath);
    const totalDuration = videoInfo.duration;
    const startTrim = options.trimStart !== undefined ? options.trimStart : defaultTrimStart;
    const endTrim = options.trimEnd !== undefined ? options.trimEnd : defaultTrimEnd;
    const finalDuration = totalDuration - startTrim - endTrim;

    if (finalDuration <= 0) {
      log("WARN", `⚠️ Video quá ngắn để cắt (${totalDuration.toFixed(1)}s), bỏ qua: ${parsedPath.base}`);
      return inputPath;
    }

    const audioLabel = options.keepAudio ? "Giữ âm thanh" : "Tắt âm thanh";
    log("INFO", `🎬 Đang xử lý (Cắt ${startTrim}s đầu & ${endTrim}s cuối | ${audioLabel}): ${parsedPath.base}`);
    log("DEBUG", `   📐 Video gốc: ${totalDuration.toFixed(1)}s | ${videoInfo.codec} | ${videoInfo.width}x${videoInfo.height}`);

    return new Promise((resolve, reject) => {
      let cmd = ffmpeg(inputPath)
        .setStartTime(startTrim)
        .setDuration(finalDuration)
        .videoCodec("copy"); // Copy codec — nhanh hơn nhiều so với re-encode

      if (!options.keepAudio) {
        cmd = cmd.noAudio(); // Tắt âm thanh (mặc định)
      } else {
        cmd = cmd.audioCodec("copy"); // Copy audio codec nếu giữ âm
      }

      cmd
        .on("end", () => {
          // Verify output file
          if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 1024) {
            reject(new Error(`File output bị lỗi hoặc quá nhỏ: ${outputPath}`));
            return;
          }

          const outputSize = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(1);
          log("INFO", `✅ Đã xử lý xong: ${path.basename(outputPath)} (${outputSize} MB, ${finalDuration.toFixed(1)}s)`);

          if (options.deleteOriginal && fs.existsSync(inputPath)) {
            fs.unlinkSync(inputPath);
            log("DEBUG", `   🗑️ Đã xóa file gốc: ${parsedPath.base}`);
          }
          resolve(outputPath);
        })
        .on("error", (err) => {
          log("ERROR", "❌ Lỗi FFmpeg:", err.message);
          reject(err);
        })
        .save(outputPath);
    });
  } catch (err) {
    log("ERROR", "❌ Lỗi xử lý video:", err.message);
    throw err;
  }
};
