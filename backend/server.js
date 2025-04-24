require("dotenv").config();
const express = require("express");
const rateLimit = require("express-rate-limit");
const cors = require("cors");
const morgan = require("morgan");
const logger = require("./logger"); // Winston logger with rotation
const http = require("http");
const { Server } = require("socket.io");
const axios = require("axios");
const { createProxyMiddleware } = require("http-proxy-middleware");
const {
    getAllIPInfo,
    getIPInfo,
    setIPInfo
} = require("./storage"); // File-based IP info storage

const app = express();
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

const requestTimeline = {}; // Format: { 'YYYY-MM-DDTHH:MM': count }
const banTimeline = {};     // Format: { 'YYYY-MM-DDTHH:MM': count }

const incrementTimeline = (timeline, label) => {
    timeline[label] = (timeline[label] || 0) + 1;};
const minuteLabel = new Date().toISOString().slice(0, 16);
incrementTimeline(banTimeline, minuteLabel);



app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Store banned IPs & risk scores
const blockedIPs = new Map();
const ipReputation = new Map();
let requestCount = 0;
const requestLogs = [];

// 📌 WebSocket Connection
io.on("connection", (socket) => {
    logger.info("⚡ New WebSocket client connected");
    socket.emit("updateStats", getStats());
    socket.emit("updateLogs", requestLogs);
});

const broadcastUpdate = () => {
    io.emit("updateStats", getStats());
    io.emit("updateLogs", requestLogs);

    

    console.log("Sending Graph Data:", {
        requests: requestTimeline,
        bans: banTimeline});    

    io.emit("updateGraphData", {
        requests: requestTimeline,
        bans: banTimeline});


        const riskyIPs = Array.from(ipReputation.entries())
        .map(([ip, score]) => ({ 
            ip, 
            score,
            info: getIPInfo(ip) || null
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
    
    const distribution = {};
    ipReputation.forEach((score) => {
        const bucket = Math.floor(score);
        distribution[bucket] = (distribution[bucket] || 0) + 1;
    });
    
    io.emit("updateRiskyIPs", { riskyIPs });
    io.emit("updateRiskDistribution", { distribution });
};


// 📌 Middleware: Log all requests
// Modify the logging middleware to prevent broadcast cascades
app.use(async (req, res, next) => {
    // Skip logging and broadcasting for API requests to avoid loops
    if (req.path.startsWith('/risky-ips') || 
        req.path.startsWith('/risk-distribution') ||
        req.path.startsWith('/graph-data') ||
        req.path.startsWith('/logs') ||
        req.path.startsWith('/dashboard')) {
        return next();
    }
    
    requestCount++;

    const clientIP = req.headers["x-forwarded-for"] || req.ip;
    const ipInfo = await fetchAndCacheIPInfo(clientIP);

    const logEntry = {
        timestamp: new Date().toISOString(),
        ip: clientIP,
        method: req.method,
        path: req.url,
        location: ipInfo ? `${ipInfo.city}, ${ipInfo.country}` : "Unknown",
        isp: ipInfo?.isp || "Unknown"
    };

    requestLogs.push(logEntry);
    logger.info(`Logged request: ${JSON.stringify(logEntry)}`);

    if (requestLogs.length > 10000) requestLogs.shift();

    // Increment request timeline count
    const minuteLabel = new Date().toISOString().slice(0, 16);
    incrementTimeline(requestTimeline, minuteLabel);

    broadcastUpdate();
    next();
});


// 📌 Honeypot Routes
const honeypots = [
    "/admin-panel",
    "/wp-login.php",
    "/api/hidden-login",
    "/private-api",
    "/cpanel"
];

app.use((req, res, next) => {
    const path = req.path.toLowerCase();
    const clientIP = req.headers["x-forwarded-for"] || req.ip;

    if (honeypots.includes(path)) {
        adjustRiskScore(clientIP, 5); // big risk jump
        blockedIPs.set(clientIP, Date.now() + 1440 * 60 * 1000); // 30 min hard ban
    

        logger.warn(`🪤 Honeypot triggered: ${clientIP} accessed ${path}`);

        requestLogs.push({
            timestamp: new Date().toISOString(),
            ip: clientIP,
            method: req.method,
            path: req.url,
            location: "🪤 Honeypot",
            isp: "Suspicious"
        });

        if (requestLogs.length > 10000) requestLogs.shift();
        broadcastUpdate();

        return res.status(403).send("🚫 Suspicious activity detected and blocked.");
    }

    next();
});


// 📌 Middleware: Block banned IPs
app.use((req, res, next) => {
    const clientIP = req.headers["x-forwarded-for"] || req.ip;
    const now = Date.now();

    if (blockedIPs.has(clientIP)) {
        const unbanTime = blockedIPs.get(clientIP);
        if (now < unbanTime) {
            logger.warn(`Blocked request from banned IP: ${clientIP}`);
            return res.status(403).send("🚫 Your IP is temporarily banned!");
        } else {
            blockedIPs.delete(clientIP);
            ipReputation.delete(clientIP);
            broadcastUpdate();
        }
    }
    next();
});

// 📌 Rate Limiting with Reputation System
const createRateLimiter = (maxRequests, timeWindowMs) => {
    return rateLimit({
        windowMs: timeWindowMs,
        max: maxRequests,
        message: "🚨 Too many requests! Slow down.",
        handler: (req, res) => {
            const clientIP = req.headers["x-forwarded-for"] || req.ip;

            // ✅ Use the centralized Adaptive Risk Engine
            adjustRiskScore(clientIP, 1);
            logger.warn(`Rate limit exceeded: ${clientIP}`);

            res.status(429).send("🚨 Too many requests! Try again later.");
        },
    });
};

// Apply rate limits
app.use("/login", createRateLimiter(5, 60 * 1000));
app.use("/data", createRateLimiter(100, 60 * 1000));

// Dummy Routes
app.post("/login", (req, res) => {
    logger.info(`Login attempt from IP: ${req.ip}`);
    res.json({ message: "✅ Login successful!" });
});

app.get("/data", (req, res) => {
    logger.info(`Data request from IP: ${req.ip}`);
    res.json({ data: "📦 Here is some dummy data!" });
});




// Proxy target (can be moved to .env for flexibility)
const TARGET_URL = process.env.TARGET_URL || "http://localhost:6000";

// Reverse proxy for all other requests not matched earlier
app.use(
    "/proxy",
    createProxyMiddleware({
        target: TARGET_URL,
        changeOrigin: true,
        pathRewrite: { "^/proxy": "" },
        logLevel: "debug",
        onProxyReq(proxyReq, req, res) {
            logger.info(`🔁 Proxying request: ${req.method} ${req.originalUrl}`);
        },
        onError(err, req, res) {
            logger.error(`❌ Proxy error: ${err.message}`);
            res.status(502).send("❌ Proxy Error");
        }
    })
);







// Get Dashboard Stats
const getStats = () => {
    const allInfo = getAllIPInfo();
    return {
        totalRequests: requestCount,
        bannedIPs: Array.from(blockedIPs.keys()).map(ip => ({
            ip,
            info: allInfo[ip] || null,
            riskScore: ipReputation.get(ip) || 0
        })),
        activeRiskScores: Object.fromEntries(ipReputation),
    };
};

app.get("/dashboard", (req, res) => {
    res.json(getStats());
});

// Manual Ban/Unban
app.post("/ban", (req, res) => {
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ error: "❌ Provide an IP to ban" });

    blockedIPs.set(ip, Date.now() + 10 * 60 * 1000);
    ipReputation.set(ip, 5);

    const minuteLabel = new Date().toISOString().slice(0, 16);
    incrementTimeline(banTimeline, minuteLabel);

    logger.warn(`🚨 Manually banned IP: ${ip}`);
    broadcastUpdate();
    res.json({ message: `🚨 Banned IP: ${ip} for 10 minutes` });
});


app.post("/unban", (req, res) => {
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ error: "❌ Provide an IP to unban" });

    blockedIPs.delete(ip);
    ipReputation.delete(ip);
    logger.info(`✅ Unbanned IP: ${ip}`);
    broadcastUpdate();
    res.json({ message: `✅ Unbanned IP: ${ip}` });
});

app.get("/banned-ips", (req, res) => {
    res.json({
        bannedIPs: Array.from(blockedIPs.keys()),
        ipReputation: Object.fromEntries(ipReputation),
    });
});

app.get("/logs", (req, res) => {
    const { ip } = req.query;
    const filtered = ip ? requestLogs.filter(log => log.ip === ip) : requestLogs;
    res.json(filtered);
});

app.post("/clear-logs", (req, res) => {
    try {
        requestLogs.length = 0;
        // logger.clear(); // commented for safe rotation
        broadcastUpdate();
        res.json({ message: "✅ Logs cleared successfully!" });
    } catch (err) {
        logger.error(`Error clearing logs: ${err.message}`);
        res.status(500).json({ error: "❌ Failed to clear logs" });
    }
});

// 📌 IP Info Fetching & Caching
const fetchAndCacheIPInfo = async (ip) => {
    let cached = getIPInfo(ip);
    if (cached) return cached;

    try {
        const res = await axios.get(`http://ip-api.com/json/${ip}`);
        const { country, city, isp, query } = res.data;

        const info = { country, city, isp, ip: query };
        setIPInfo(ip, info);
        return info;
    } catch (err) {
        logger.error(`🌐 Failed to fetch IP info for ${ip}: ${err.message}`);
        return null;
    }
};

// Error Handler
app.use((err, req, res, next) => {
    logger.error(`Error: ${err.message}`);
    res.status(500).json({ error: "Something went wrong!" });
});


//graphs
app.get("/graph-data", (req, res) => {
    res.json({
        requests: requestTimeline,
        bans: banTimeline});
    });






// 📌 Adaptive Risk Engine Settings
const RISK_THRESHOLD = 5;
const MAX_BAN_DURATION_MS = 30 * 60 * 1000; // 30 min
const BASE_BAN_TIME_MS = 5 * 60 * 1000;     // 5 min
const RISK_DECAY_INTERVAL = 60 * 1000;      // every minute
const RISK_DECAY_AMOUNT = 1;

// 📌 Centralized Risk Adjuster
const adjustRiskScore = (ip, delta = 1) => {
    let score = ipReputation.get(ip) || 0;
    score += delta;

    if (score >= RISK_THRESHOLD) {
        const now = Date.now();
        const banDuration = Math.min(BASE_BAN_TIME_MS * score, MAX_BAN_DURATION_MS);
        blockedIPs.set(ip, now + banDuration);

        const minuteLabel = new Date().toISOString().slice(0, 16);
        incrementTimeline(banTimeline, minuteLabel);

        logger.warn(`🚨 Auto-banned IP: ${ip} | Risk: ${score} | Duration: ${banDuration / 60000}m`);
        broadcastUpdate();
    } else {
        ipReputation.set(ip, score);
        logger.info(`📈 Risk adjusted: ${ip} => ${score}`);
    }
};

// 📉 Periodic Risk Decay
setInterval(() => {
    for (const [ip, score] of ipReputation.entries()) {
        const newScore = score - RISK_DECAY_AMOUNT;
        if (newScore <= 0) {
            ipReputation.delete(ip);
        } else {
            ipReputation.set(ip, newScore);
        }
    }
}, RISK_DECAY_INTERVAL);





// Add this to the server code, near the other endpoints

// Get Top Risky IPs - sorted by risk score
app.get("/risky-ips", (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit) : 10;
    
    // Convert the Map to an array and sort by risk score
    const riskySortedIPs = Array.from(ipReputation.entries())
        .map(([ip, score]) => ({ 
            ip, 
            score,
            info: getIPInfo(ip) || null
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    
    res.json({ riskyIPs: riskySortedIPs });
});

// Get Risk Score Distribution for Heatmap
app.get("/risk-distribution", (req, res) => {
    // Group risk scores into buckets for the heatmap
    const distribution = {};
    
    ipReputation.forEach((score) => {
        // Round score to nearest integer for grouping
        const bucket = Math.floor(score);
        distribution[bucket] = (distribution[bucket] || 0) + 1;
    });
    
    res.json({ distribution });
});



// Start Server
server.listen(PORT, () => {
    logger.info(`🚀 Server running on http://localhost:${PORT}`);
});
