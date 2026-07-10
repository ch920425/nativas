import { spawn } from "node:child_process";
import { startLocalApi } from "./server.ts";

const api = await startLocalApi();
const web = spawn("npm", ["run", "dev", "--workspace", "@nativas/web", "--", "--host", "127.0.0.1"], {
  env: { ...process.env, VITE_TRANSPORT: "live", VITE_API_BASE_URL: `http://127.0.0.1:${api.port}` },
  stdio: "inherit",
});

console.log(`nativas API: http://127.0.0.1:${api.port}`);
console.log("nativas web: http://127.0.0.1:5173");

const stop = async () => {
  web.kill("SIGTERM");
  await api.close();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
web.once("exit", async (code) => { await api.close(); process.exit(code ?? 0); });
