// save as proxyTarget.js
const express = require("express");
const app = express();
app.get("/hello", (req, res) => res.send("👋 Hello from the target server!"));
app.listen(6000, () => console.log("🎯 Target running at http://localhost:6000"));
