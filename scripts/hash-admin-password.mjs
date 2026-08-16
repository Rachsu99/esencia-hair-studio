import { pbkdf2 as pbkdf2Callback, randomBytes } from "node:crypto";
import { promisify } from "node:util";

const pbkdf2 = promisify(pbkdf2Callback);
const iterations = 100_000;

function hiddenPrompt(label) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Run this command in an interactive terminal.");
  }
  return new Promise((resolve, reject) => {
    let value = "";
    process.stdout.write(label);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    const finish = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener("data", onData);
      process.stdout.write("\n");
    };
    const onData = (key) => {
      if (key === "\u0003") {
        finish();
        reject(new Error("Cancelled."));
      } else if (key === "\r" || key === "\n") {
        finish();
        resolve(value);
      } else if (key === "\u007f" || key === "\b") {
        if (value) {
          value = value.slice(0, -1);
          process.stdout.write("\b \b");
        }
      } else if (key >= " ") {
        value += key;
        process.stdout.write("•");
      }
    };
    process.stdin.on("data", onData);
  });
}

try {
  const password = await hiddenPrompt("New admin password: ");
  if (password.length < 14 || password.length > 256) throw new Error("Password must be between 14 and 256 characters.");
  const confirmation = await hiddenPrompt("Confirm password: ");
  if (password !== confirmation) throw new Error("Passwords do not match.");
  const salt = randomBytes(24);
  const hash = await pbkdf2(password, salt, iterations, 32, "sha256");
  process.stdout.write(`\nCopy this complete value into the ADMIN_PASSWORD_HASH secret:\n\npbkdf2-sha256$${iterations}$${salt.toString("base64")}$${hash.toString("base64")}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "Unable to create password hash."}\n`);
  process.exitCode = 1;
}
