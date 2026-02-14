const { createServer } = require("node:http");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const html = readFileSync(join(__dirname, "test-page.html"));

createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(html);
}).listen(3193, () => console.log("fixture server on http://localhost:3193"));
