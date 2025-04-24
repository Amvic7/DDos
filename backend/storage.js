const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "ipData.json");

// Ensure the data file exists
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2));
}

// Read the full JSON file
const readData = () => {
    try {
        const raw = fs.readFileSync(DATA_FILE);
        return JSON.parse(raw);
    } catch (err) {
        console.error("Failed to read storage file:", err);
        return {};
    }
};

// Write to the JSON file
const writeData = (data) => {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Failed to write storage file:", err);
    }
};

// Get IP metadata (e.g. country, city, ISP)
const getIPInfo = (ip) => {
    const data = readData();
    return data[ip] || null;
};

// Set or update IP metadata
const setIPInfo = (ip, info) => {
    const data = readData();
    data[ip] = {
        ...info,
        timestamp: new Date().toISOString()
    };
    writeData(data);
};

// Get all stored IP metadata
const getAllIPInfo = () => {
    return readData();
};

// Export module
module.exports = {
    getIPInfo,
    setIPInfo,
    getAllIPInfo,
};
