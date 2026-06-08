import { sleep } from "../scripts/utils.js";

/**
 * Kỹ năng tự động đăng bài / lên lịch lên Fanpage (Đã tắt theo yêu cầu User)
 */
export const schedulePost = async (page, pageName, videoPath, caption, postIndex = 0) => {
  console.log(`\n⏳ (Tính năng Lên Lịch Tự Động đã được tắt theo yêu cầu của anh).`);
  console.log(`📁 File video: ${videoPath}`);
  console.log(`📝 File caption đã lưu sẵn trong thư mục.`);
  return true;
};
