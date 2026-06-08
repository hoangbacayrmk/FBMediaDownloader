import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "ffmpeg-static";
import ffprobeInstaller from "ffprobe-static";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

ffmpeg.setFfmpegPath(ffmpegInstaller);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

const getDuration = (inputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) reject(err);
      else resolve(metadata.format.duration);
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
  try {
    const parsedPath = path.parse(inputPath);
    // Tên file mới sẽ có thêm hậu tố _cut để anh dễ phân biệt
    const outputPath = path.join(parsedPath.dir, `${parsedPath.name}_cut${parsedPath.ext}`);

    // Đọc giá trị mặc định từ .env, fallback về 1 giây
    const defaultTrimStart = parseFloat(process.env.DEFAULT_TRIM_START) || 1;
    const defaultTrimEnd = parseFloat(process.env.DEFAULT_TRIM_END) || 1;

    const totalDuration = await getDuration(inputPath);
    const startTrim = options.trimStart !== undefined ? options.trimStart : defaultTrimStart;
    const endTrim = options.trimEnd !== undefined ? options.trimEnd : defaultTrimEnd;
    const finalDuration = totalDuration - startTrim - endTrim;

    if (finalDuration <= 0) {
      console.log(`⚠️ Video quá ngắn để cắt (${totalDuration.toFixed(1)}s), bỏ qua: ${parsedPath.base}`);
      return inputPath;
    }

    const audioLabel = options.keepAudio ? "Giữ âm thanh" : "Tắt âm thanh";
    console.log(`🎬 Đang xử lý (Cắt ${startTrim}s đầu & ${endTrim}s cuối | ${audioLabel}): ${parsedPath.base}...`);

    return new Promise((resolve, reject) => {
      let cmd = ffmpeg(inputPath)
        .setStartTime(startTrim)
        .setDuration(finalDuration);

      if (!options.keepAudio) {
        cmd = cmd.noAudio(); // Tắt âm thanh (mặc định)
      }

      cmd
        .on("end", () => {
          console.log(`✅ Đã xử lý xong, lưu thành file mới: ${path.basename(outputPath)}`);
          if (options.deleteOriginal && fs.existsSync(inputPath)) {
            fs.unlinkSync(inputPath);
          }
          resolve(outputPath);
        })
        .on("error", (err) => {
          console.error("❌ Lỗi FFmpeg: ", err.message);
          reject(err);
        })
        .save(outputPath);
    });
  } catch (err) {
    console.error("❌ Lỗi xử lý video: ", err.message);
    throw err;
  }
};
