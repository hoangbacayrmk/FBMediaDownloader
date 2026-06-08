import fs from "fs";
import path from "path";
import { rewriteCaption } from "../Skill/rewriter.js";

const REELS_DIR = "downloads/reels_download";

async function batchRewrite() {
  console.log("🚀 Bắt đầu quá trình viết lại toàn bộ caption...");
  
  const folders = fs.readdirSync(REELS_DIR).filter(f => fs.lstatSync(path.join(REELS_DIR, f)).isDirectory());
  
  let count = 0;
  for (const folder of folders) {
    const folderPath = path.join(REELS_DIR, folder);
    const files = fs.readdirSync(folderPath).filter(f => f.endsWith(".txt") && !f.includes("_original"));
    
    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const currentText = fs.readFileSync(filePath, "utf-8");
      // Đọc từ bản gốc nếu có, nếu không thì dùng bản hiện tại và lưu backup
      let textToRewrite = currentText;

      const originalPath = filePath.replace(".txt", "_original.txt");
      if (fs.existsSync(originalPath)) {
        textToRewrite = fs.readFileSync(originalPath, "utf-8");
      } else {
        fs.writeFileSync(originalPath, currentText);
      }
      
      const rewritten = await rewriteCaption(textToRewrite);

      fs.writeFileSync(filePath, rewritten);
      count++;
      process.stdout.write(`\r✅ Đã xử lý: ${count}/${folders.length} file...`);
      await new Promise(r => setTimeout(r, 5000)); // Chờ 5s để tránh Rate Limit (429)
    }

  }
  console.log("\n✨ Hoàn tất viết lại toàn bộ caption!");
}

batchRewrite().catch(console.error);
