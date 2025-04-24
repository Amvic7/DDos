const { createLogger, format, transports } = require("winston");
require("winston-daily-rotate-file");

// Custom log format: [Timestamp] Level: Message
const logFormat = format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()}: ${message}`)
);

// Daily rotating transport for requests & errors
const requestTransport = new transports.DailyRotateFile({
    filename: "logs/requests-%DATE%.log",
    datePattern: "YYYY-MM-DD",
    maxFiles: "7d", // Keep logs for 7 days
});

const errorTransport = new transports.DailyRotateFile({
    filename: "logs/errors-%DATE%.log",
    datePattern: "YYYY-MM-DD",
    level: "error",
    maxFiles: "14d", // Keep error logs for 14 days
});

// Create logger
const logger = createLogger({
    level: "info",
    format: logFormat,
    transports: [
        requestTransport,
        errorTransport,
        new transports.Console(), // Also log to console
    ],
});

// Export logger
module.exports = logger;
