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
    log(`> Đã tạo thư mục ${dir}.`);
  }
};

export const saveToFile = (fileName, data, override = false) => {
  try {
    fs.writeFileSync(fileName, data, { flag: override ? "w+" : "a+" });
    log(`> Đã lưu vào file ${fileName}`);
  } catch (err) {
    console.error("[!] ERROR: ", err);
  }
};

export const download = async (url, destination) => {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });
  if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  // Kiểm tra nếu file quá nhỏ (dưới 10KB) thì có khả năng là file lỗi hoặc DASH fragment
  if (buffer.length < 10240 && url.includes("fbcdn.net")) {
    throw new Error("Downloaded file is too small (possibly an invalid fragment).");
  }

  fs.writeFileSync(destination, buffer);
  return true;
};
