import fs from "fs";
import path from "path";
import { rewriteCaption } from "../Skill/rewriter.js";

const REELS_DIR = "downloads/reels_download";

async function batchRewrite() {
  console.log("🚀 Bắt đầu quá trình viết lại toàn bộ caption...\n");

  if (!fs.existsSync(REELS_DIR)) {
    console.error(`❌ Thư mục ${REELS_DIR} không tồn tại. Chưa có video nào được tải.`);
    process.exit(1);
  }

  // Duyệt tất cả thư mục con (mỗi thư mục = 1 video)
  const folders = fs.readdirSync(REELS_DIR, { recursive: true }).length
    ? fs.readdirSync(REELS_DIR).filter(f => {
        const fullPath = path.join(REELS_DIR, f);
        return fs.lstatSync(fullPath).isDirectory();
      })
    : [];

  // Đếm tổng số file cần xử lý
  let totalFiles = 0;
  const fileMap = [];
  for (const folder of folders) {
    const folderPath = path.join(REELS_DIR, folder);

    // Tìm sub-folders nếu có (page_name/reel_xxx)
    const subItems = fs.readdirSync(folderPath);
    for (const sub of subItems) {
      const subPath = path.join(folderPath, sub);
      if (fs.lstatSync(subPath).isDirectory()) {
        // Đây là sub-folder (reel_xxx bên trong page folder)
        const txtFiles = fs.readdirSync(subPath).filter(f => f.endsWith(".txt") && !f.includes("_original"));
        for (const file of txtFiles) {
          fileMap.push({ folder: subPath, file });
          totalFiles++;
        }
      } else if (sub.endsWith(".txt") && !sub.includes("_original")) {
        // File .txt nằm trực tiếp trong folder
        fileMap.push({ folder: folderPath, file: sub });
        totalFiles++;
      }
    }
  }

  if (totalFiles === 0) {
    console.log("⚠️ Không tìm thấy file caption nào để viết lại.");
    return;
  }

  console.log(`📝 Tìm thấy ${totalFiles} file caption cần viết lại.\n`);

  let count = 0;
  for (const { folder, file } of fileMap) {
    const filePath = path.join(folder, file);
    const currentText = fs.readFileSync(filePath, "utf-8");

    // Đọc từ bản gốc nếu có, nếu không thì dùng bản hiện tại và lưu backup
    let textToRewrite = currentText;
    const originalPath = filePath.replace(".txt", "_original.txt");

    if (fs.existsSync(originalPath)) {
      textToRewrite = fs.readFileSync(originalPath, "utf-8");
    } else {
      fs.writeFileSync(originalPath, currentText);
    }

    try {
      const rewritten = await rewriteCaption(textToRewrite);
      fs.writeFileSync(filePath, rewritten);
      count++;
      process.stdout.write(`\r✅ Đã xử lý: ${count}/${totalFiles} file...`);
    } catch (err) {
      count++;
      console.error(`\n⚠️ Lỗi khi viết lại "${file}": ${err.message}`);
    }

    // Chờ 5s để tránh Rate Limit (429)
    await new Promise(r => setTimeout(r, parseInt(process.env.REWRITE_DELAY_MS) || 5000));
  }

  console.log(`\n\n✨ Hoàn tất! Đã viết lại ${count}/${totalFiles} caption.`);
}

batchRewrite().catch(console.error);
