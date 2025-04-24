import { useState, useEffect } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import GraphDashboard from "./GraphDashboard";
import RiskyIPsLeaderboard from "./RiskyIPsLeaderboard";
import RiskHeatmap from "./RiskHeatMap";
import socket from "./socket";

function App() {
  const [stats, setStats] = useState({
    totalRequests: 0,
    bannedIPs: [],
    activeRiskScores: {},
  });

  const [logs, setLogs] = useState([]);
  const [filterIP, setFilterIP] = useState("");
  const [banIP, setBanIP] = useState("");
  const [unbanIP, setUnbanIP] = useState("");
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    // Backend connection listeners
    socket.on("updateStats", (data) => {
      setStats(data);
    });

    socket.on("updateLogs", (data) => {
      setLogs(data);
    });

    // Window resize listener
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      // Clean up listeners
      socket.off("updateStats");
      socket.off("updateLogs");
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const clearLogs = async () => {
    try {
      await axios.post("https://ddos-project.onrender.com/clear-logs");
      setLogs([]);
    } catch (error) {
      console.error("Error clearing logs:", error);
    }
  };

  const banIPHandler = async () => {
    if (!banIP.trim()) return;
    try {
      await axios.post("https://ddos-project.onrender.com/ban", { ip: banIP });
      setBanIP("");
    } catch (error) {
      console.error("Error banning IP:", error);
    }
  };

  const unbanIPHandler = async () => {
    if (!unbanIP.trim()) return;
    try {
      await axios.post("https://ddos-project.onrender.com/unban", { ip: unbanIP });
      setUnbanIP("");
    } catch (error) {
      console.error("Error unbanning IP:", error);
    }
  };

  return (
    <div className="bg-light min-vh-100 d-flex flex-column ">
      {/* Navbar */}
      <nav className="navbar navbar-expand-lg navbar-dark bg-primary">
        <div className="container-fluid">
          <span className="navbar-brand">
            <i className="bi bi-shield-fill-check me-2"></i> 
            DDoS Protection Dashboard
          </span>
          <div className="ms-auto d-flex gap-2">
            <div className="badge bg-light text-primary p-2">
              Total Requests: {stats.totalRequests}
            </div>
            <div className="badge bg-danger p-2">
              Banned IPs: {stats.bannedIPs.length}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container-fluid p-3">
        {/* Top Row - IP Management & Quick Stats */}
        <div className="row g-3 mb-3">
          {/* Ban IP */}
          <div className="col-12 col-md-4">
            <div className="card h-100 border-0 shadow-sm">
              <div className="card-header bg-white">
                <h5 className="card-title mb-0">
                  <i className="bi bi-shield-fill-x text-danger me-2"></i>
                  Ban IP Address
                </h5>
              </div>
              <div className="card-body">
                <div className="input-group">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter IP to ban..."
                    value={banIP}
                    onChange={(e) => setBanIP(e.target.value)}
                  />
                  <button 
                    className="btn btn-danger" 
                    onClick={banIPHandler}
                  >
                    <i className="bi bi-shield-fill-x me-1"></i>
                    Ban
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Unban IP */}
          <div className="col-12 col-md-4">
            <div className="card h-100 border-0 shadow-sm">
              <div className="card-header bg-white">
                <h5 className="card-title mb-0">
                  <i className="bi bi-shield-check text-success me-2"></i>
                  Unban IP Address
                </h5>
              </div>
              <div className="card-body">
                <div className="input-group">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter IP to unban..."
                    value={unbanIP}
                    onChange={(e) => setUnbanIP(e.target.value)}
                  />
                  <button 
                    className="btn btn-success" 
                    onClick={unbanIPHandler}
                  >
                    <i className="bi bi-unlock me-1"></i>
                    Unban
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Logs */}
          <div className="col-12 col-md-4">
            <div className="card h-100 border-0 shadow-sm">
              <div className="card-header bg-white">
                <h5 className="card-title mb-0">
                  <i className="bi bi-funnel-fill text-primary me-2"></i>
                  Filter Logs
                </h5>
              </div>
              <div className="card-body">
                <div className="input-group">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Filter logs by IP..."
                    value={filterIP}
                    onChange={(e) => setFilterIP(e.target.value)}
                  />
                  <button 
                    className="btn btn-outline-danger" 
                    onClick={clearLogs}
                  >
                    <i className="bi bi-trash me-1"></i>
                    Clear Logs
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Middle Row - Graphs & Stats */}
        <div className="row g-3 mb-3">
          {/* Traffic Analytics */}
          <div className="col-12 col-lg-8">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white">
                <h5 className="card-title mb-0">
                  <i className="bi bi-graph-up-arrow text-success me-2"></i>
                  Traffic Analytics
                </h5>
              </div>
              <div className="card-body">
                <GraphDashboard />
              </div>
            </div>
          </div>
          
          {/* Risk Distribution */}
          <div className="col-12 col-lg-4">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white">
                <h5 className="card-title mb-0">
                  <i className="bi bi-bar-chart-fill text-primary me-2"></i>
                  Risk Distribution
                </h5>
              </div>
              <div className="card-body">
                <RiskHeatmap />
              </div>
            </div>
          </div>
        </div>
        
        {/* Bottom Section - Tables */}
        <div className="row g-3">
          {/* Banned IPs Table */}
          <div className="col-12 col-lg-6">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white d-flex justify-content-between align-items-center">
                <h5 className="card-title mb-0">
                  <i className="bi bi-slash-circle text-danger me-2"></i>
                  Banned IP Addresses
                </h5>
                <span className="badge bg-danger p-2">{stats.bannedIPs.length}</span>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive" style={{ height: "300px" }}>
                  <table className="table table-hover table-striped mb-0">
                    <thead className="table-light sticky-top">
                      <tr>
                        <th>IP Address</th>
                        <th>Risk Score</th>
                        {windowWidth >= 768 && <th>Location</th>}
                        {windowWidth >= 992 && <th>ISP</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {stats.bannedIPs.length > 0 ? (
                        stats.bannedIPs.map((entry, index) => (
                          <tr key={index}>
                            <td>
                              <span className="fw-bold">{entry.ip}</span>
                            </td>
                            <td>
                              <span className={`badge ${
                                entry.riskScore >= 4 ? "bg-danger" : 
                                entry.riskScore >= 2 ? "bg-warning" : "bg-info"
                              } p-2`}>
                                {entry.riskScore}
                              </span>
                            </td>
                            {windowWidth >= 768 && (
                              <td>
                                {entry.info?.city || "Unknown"}, {entry.info?.country || "Unknown"}
                              </td>
                            )}
                            {windowWidth >= 992 && (
                              <td>{entry.info?.isp || "Unknown"}</td>
                            )}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={windowWidth >= 992 ? 4 : windowWidth >= 768 ? 3 : 2} className="text-center py-4">
                            <i className="bi bi-shield-check text-success me-2 fs-4"></i>
                            No banned IPs detected
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          
          {/* Top Risky IPs & Request Logs Combined */}
          <div className="col-12 col-lg-6">
            <div className="card border-0 shadow-sm mb-3">
              <div className="card-header bg-white">
                <h5 className="card-title mb-0">
                  <i className="bi bi-exclamation-triangle-fill text-warning me-2"></i>
                  Top Risky IPs
                </h5>
              </div>
              <div className="card-body p-0">
                <RiskyIPsLeaderboard />
              </div>
            </div>
            
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white">
                <h5 className="card-title mb-0">
                  <i className="bi bi-journal-text text-primary me-2"></i>
                  Recent Request Logs
                </h5>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive" style={{ height: "200px" }}>
                  <table className="table table-hover table-striped mb-0">
                    <thead className="table-light sticky-top">
                      <tr>
                        {windowWidth >= 768 && <th>Time</th>}
                        <th>IP</th>
                        <th>Method</th>
                        <th>Path</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.length > 0 ? (
                        logs
                          .filter(log => !filterIP || log.ip.includes(filterIP))
                          .slice(0, 50) // Limit to last 50 logs for performance
                          .map((log, index) => (
                            <tr key={index}>
                              {windowWidth >= 768 && <td>{log.timestamp}</td>}
                              <td>{log.ip}</td>
                              <td>
                                <span className={`badge ${
                                  log.method === "GET" ? "bg-success" : 
                                  log.method === "POST" ? "bg-primary" : 
                                  log.method === "DELETE" ? "bg-danger" : "bg-secondary"
                                } p-2`}>
                                  {log.method}
                                </span>
                              </td>
                              <td className="text-truncate" style={{ maxWidth: "150px" }}>
                                {log.path}
                              </td>
                            </tr>
                          ))
                      ) : (
                        <tr>
                          <td colSpan={windowWidth >= 768 ? 4 : 3} className="text-center py-4">
                            <i className="bi bi-clock-history text-secondary me-2 fs-4"></i>
                            No request logs found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <footer className="bg-dark text-white text-center py-2 mt-auto">
        <div className="container-fluid">
          <div className="row align-items-center">
            <div className="col-md-4 text-md-start">
              <small>v1.2.0</small>
            </div>
            <div className="col-md-4">
              <small>DDoS Protection Dashboard &copy; {new Date().getFullYear()}</small>
            </div>
            <div className="col-md-4 text-md-end">
              <small>Server Status: <span className="text-success">Online</span></small>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
