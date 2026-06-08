import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "ffmpeg-static";
import ffprobeInstaller from "ffprobe-static";
import path from "path";
import fs from "fs";

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

export const processVideo = async (inputPath, options = {}) => {
  try {
    const parsedPath = path.parse(inputPath);
    // Tên file mới sẽ có thêm hậu tố _cut để anh dễ phân biệt
    const outputPath = path.join(parsedPath.dir, `${parsedPath.name}_cut${parsedPath.ext}`);
    
    const totalDuration = await getDuration(inputPath);
    const startTrim = options.trimStart || 1;
    const endTrim = options.trimEnd || 1;
    const finalDuration = totalDuration - startTrim - endTrim;

    if (finalDuration <= 0) {
      console.log(`⚠️ Video quá ngắn, bỏ qua: ${parsedPath.base}`);
      return inputPath;
    }

    console.log(`🎬 Đang xử lý (Cắt 1s đầu & cuối + Tắt 100% âm thanh): ${parsedPath.base}...`);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(startTrim)
        .setDuration(finalDuration)
        .noAudio() // Tắt 100% âm thanh video theo yêu cầu của User
        .on("end", () => {
          console.log(`✅ Đã cắt và tắt âm xong, lưu thành file mới: ${path.basename(outputPath)}`);
          if (options.deleteOriginal) {
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            resolve(outputPath);
          } else {
            resolve(outputPath);
          }
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
