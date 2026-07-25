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
 * @param {boolean} [options.addMusic]       - Thêm nhạc nền ngẫu nhiên.
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
    const middleCutDuration = 1.0; // Mặc định cắt 1 giây ở giữa

    const finalDuration = totalDuration - startTrim - endTrim - middleCutDuration;

    if (finalDuration <= 2) {
      log("WARN", `⚠️ Video quá ngắn để cắt phức tạp (${totalDuration.toFixed(1)}s), bỏ qua: ${parsedPath.base}`);
      return inputPath;
    }

    const middlePoint = totalDuration / 2;
    const p1Start = startTrim;
    const p1End = middlePoint - (middleCutDuration / 2);
    const p2Start = middlePoint + (middleCutDuration / 2);
    const p2End = totalDuration - endTrim;

    const audioLabel = options.keepAudio && !options.addMusic ? "Giữ âm thanh gốc" : (options.addMusic ? "Thêm nhạc nền (Thay thế âm)" : "Tắt âm thanh");
    log("INFO", `🎬 Đang xử lý Cắt Nâng Cao (Đầu: ${startTrim}s, Giữa: ${middleCutDuration}s, Đuôi: ${endTrim}s | ${audioLabel}): ${parsedPath.base}`);
    log("DEBUG", `   📐 Video gốc: ${totalDuration.toFixed(1)}s | ${videoInfo.codec} | ${videoInfo.width}x${videoInfo.height}`);

    return new Promise((resolve, reject) => {
      let cmd = ffmpeg(inputPath);

      // --- CẮT GHÉP COMPLEX FILTER ---
      const filters = [
        // Cắt phần 1
        `[0:v]trim=start=${p1Start}:end=${p1End},setpts=PTS-STARTPTS[v1]`,
        // Cắt phần 2
        `[0:v]trim=start=${p2Start}:end=${p2End},setpts=PTS-STARTPTS[v2]`,
        // Nối video
        `[v1][v2]concat=n=2:v=1:a=0[vout]`
      ];

      // Mặc định map video output từ concat
      const outputMaps = ['-map', '[vout]'];
      let isReEncodeAudio = false;

      // Xử lý giữ âm gốc nếu không chèn nhạc mới
      if (!options.addMusic && options.keepAudio) {
        filters.push(`[0:a]atrim=start=${p1Start}:end=${p1End},asetpts=PTS-STARTPTS[a1]`);
        filters.push(`[0:a]atrim=start=${p2Start}:end=${p2End},asetpts=PTS-STARTPTS[a2]`);
        filters.push(`[a1][a2]concat=n=2:v=0:a=1[aout]`);
        outputMaps.push('-map', '[aout]');
        isReEncodeAudio = true;
      }

      cmd.complexFilter(filters).outputOptions(outputMaps);

      // Do dùng complex_filter, BẮT BUỘC phải re-encode video
      // CRF 18 + preset 'medium' giữ chất lượng gần như gốc (ultrafast/crf23 làm video bị mờ/vỡ khối)
      cmd.videoCodec("libx264").outputOptions(['-crf', '18', '-preset', 'medium']);

      // --- CHÈN NHẠC NỀN ---
      let musicPath = null;
      if (options.addMusic) {
        // Ưu tiên truyền nhạc qua biến musicFilePath nếu có (tải song song)
        if (options.musicFilePath && fs.existsSync(options.musicFilePath)) {
          musicPath = options.musicFilePath;
        } else {
          // Fallback lấy ngẫu nhiên từ kho
          const musicDir = path.resolve("./assets/bg_music");
          if (fs.existsSync(musicDir)) {
            const files = fs.readdirSync(musicDir).filter(f => f.endsWith(".mp3"));
            if (files.length > 0) {
              const randomFile = files[Math.floor(Math.random() * files.length)];
              musicPath = path.join(musicDir, randomFile);
            }
          }
        }
      }

      if (musicPath) {
        log("INFO", `🎵 Đang chèn nhạc: ${path.basename(musicPath)}`);
        log("INFO", `   🛡️ Kích hoạt lách bản quyền: Tăng tốc độ nhạc lên 5% (atempo=1.05)`);
        cmd
          .input(musicPath)
          .inputOptions(['-stream_loop', '-1']) // Lặp nhạc vô hạn
          .outputOptions(['-map', '1:a:0', '-shortest']) // Map âm thanh nhạc, cắt bằng video (-shortest)
          .audioCodec("aac")
          .audioFilters("volume=0.8,atempo=1.05"); // Bypass FB copyright
      } else {
        if (!options.keepAudio) {
          cmd.noAudio();
        } else if (isReEncodeAudio) {
          cmd.audioCodec("aac"); // Re-encode nếu đã cắt audio gốc
        } else {
          cmd.audioCodec("copy"); // Fallback
        }
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
