import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

const projectRoot = process.cwd();
const envFiles = [".env", ".env.local"];

for (const fileName of envFiles) {
  const filePath = path.resolve(projectRoot, fileName);
  if (fs.existsSync(filePath)) {
    dotenv.config({ path: filePath, override: true });
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not defined. Please set it in .env.local (see README)."
  );
}


