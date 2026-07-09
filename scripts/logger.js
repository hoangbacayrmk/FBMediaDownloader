import fs from "fs";
import path from "path";

const LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const COLORS = {
  DEBUG: "\x1b[36m", // Cyan
  INFO:  "\x1b[32m", // Green
  WARN:  "\x1b[33m", // Yellow
  ERROR: "\x1b[31m", // Red
};
const RESET = "\x1b[0m";
const LOG_DIR = "downloads";
const LOG_FILE = path.join(LOG_DIR, "app.log");

let currentLevel = LEVELS.INFO;

/**
 * Thay đổi log level.
 * @param {'DEBUG'|'INFO'|'WARN'|'ERROR'} level
 */
export const setLogLevel = (level) => {
  currentLevel = LEVELS[level] !== undefined ? LEVELS[level] : LEVELS.INFO;
};

/**
 * Ghi log ra console (có màu) + file.
 * @param {'DEBUG'|'INFO'|'WARN'|'ERROR'} level - Mức độ log.
 * @param  {...any} params - Nội dung log.
 *
 * Dùng: log('INFO', 'Đang tải video...')
 *   hoặc: log('Đang tải video...')  ← mặc định INFO
 */
export const log = (level, ...params) => {
  // Nếu gọi log('message') không có level → mặc định INFO
  if (LEVELS[level] === undefined) {
    params.unshift(level);
    level = "INFO";
  }

  if (LEVELS[level] < currentLevel) return;

  const now = new Date();
  const timestamp = now.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });

  const prefix = `${COLORS[level]}[${timestamp}] [${level}]${RESET}`;
  console.log(prefix, ...params);

  // Ghi ra file (plain text, không có ANSI colors)
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    const plainLine = `[${timestamp}] [${level}] ${params.map(p => typeof p === 'object' ? JSON.stringify(p) : String(p)).join(" ")}\n`;
    fs.appendFileSync(LOG_FILE, plainLine, { flag: "a" });
  } catch {
    // Nếu không ghi được file → bỏ qua (không crash app)
  }
};
