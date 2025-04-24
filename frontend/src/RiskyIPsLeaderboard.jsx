import React, { useState, useEffect } from "react";
import axios from "axios";
import socket from "./socket";

const RiskyIPsLeaderboard = () => {
    const [riskyIPs, setRiskyIPs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Initial fetch
        const fetchRiskyIPs = async () => {
            try {
                const response = await axios.get("http://localhost:5000/risky-ips?limit=10");
                setRiskyIPs(response.data.riskyIPs);
                setLoading(false);
            } catch (error) {
                console.error("Error fetching risky IPs:", error);
                setLoading(false);
            }
        };

        fetchRiskyIPs();
        
        // Socket listener for real-time updates
        const handleUpdateRiskyIPs = (data) => {
            setRiskyIPs(data.riskyIPs);
            setLoading(false);
        };
        
        socket.on("updateRiskyIPs", handleUpdateRiskyIPs);
        
        // Important: Clean up the socket listener
        return () => {
            socket.off("updateRiskyIPs", handleUpdateRiskyIPs);
        };
    }, []); // Empty dependency array to run once on mount

    return (
        <div className="card p-3 my-3">
            <h4> Top Risky IPs Leaderboard</h4>
            {loading ? (
                <p>Loading...</p>
            ) : riskyIPs.length > 0 ? (
                <table className="table table-striped">
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>IP</th>
                            <th>Risk Score</th>
                            <th>Location</th>
                            <th>ISP</th>
                        </tr>
                    </thead>
                    <tbody>
                        {riskyIPs.map((entry, index) => (
                            <tr key={index}>
                                <td>#{index + 1}</td>
                                <td>{entry.ip}</td>
                                <td>
                                    <span className={`badge bg-${
                                        entry.score >= 4 ? "danger" : 
                                        entry.score >= 2 ? "warning" : "info"
                                    }`}>
                                        {entry.score.toFixed(1)}
                                    </span>
                                </td>
                                <td>{entry.info?.city}, {entry.info?.country || "Unknown"}</td>
                                <td>{entry.info?.isp || "Unknown"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                <p>No risky IPs detected</p>
            )}
        </div>
    );
};

export default RiskyIPsLeaderboard;
