import React, { useState, useEffect } from "react";
import axios from "axios";
import { Bar } from "react-chartjs-2";
import socket from "./socket";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from "chart.js";

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

const RiskHeatmap = () => {
    const [distribution, setDistribution] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Initial fetch
        const fetchDistribution = async () => {
            try {
                const response = await axios.get("http://localhost:5000/risk-distribution");
                setDistribution(response.data.distribution);
                setLoading(false);
            } catch (error) {
                console.error("Error fetching risk distribution:", error);
                setLoading(false);
            }
        };

        fetchDistribution();
        
        // Socket listener for real-time updates
        const handleUpdateDistribution = (data) => {
            setDistribution(data.distribution);
            setLoading(false);
        };
        
        socket.on("updateRiskDistribution", handleUpdateDistribution);
        
        // Important: Clean up the socket listener
        return () => {
            socket.off("updateRiskDistribution", handleUpdateDistribution);
        };
    }, []); // Empty dependency array to run once on mount

    // Chart data preparation (rest of the code remains the same)
    const chartData = {
        labels: Object.keys(distribution).map(score => `Risk Level ${score}`),
        datasets: [
            {
                label: "Number of IPs",
                data: Object.values(distribution),
                backgroundColor: Object.keys(distribution).map(score => {
                    const numScore = parseInt(score);
                    if (numScore >= 4) return "rgba(220, 53, 69, 0.7)";
                    if (numScore >= 2) return "rgba(255, 193, 7, 0.7)";
                    return "rgba(23, 162, 184, 0.7)";
                }),
                borderColor: Object.keys(distribution).map(score => {
                    const numScore = parseInt(score);
                    if (numScore >= 4) return "rgb(220, 53, 69)";
                    if (numScore >= 2) return "rgb(255, 193, 7)";
                    return "rgb(23, 162, 184)";
                }),
                borderWidth: 1,
            },
        ],
    };

    // Rest of the component remains the same
    const options = {
        responsive: true,
        plugins: {
            legend: {
                position: "top",
            },
            title: {
                display: true,
                text: "IP Risk Score Distribution",
            },
            tooltip: {
                callbacks: {
                    label: (context) => {
                        const label = context.dataset.label || "";
                        const value = context.raw || 0;
                        return `${label}: ${value} IP${value !== 1 ? "s" : ""}`;
                    },
                },
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: "Number of IPs",
                },
                ticks: {
                    precision: 0,
                },
            },
            x: {
                title: {
                    display: true,
                    text: "Risk Score Level",
                },
            },
        },
    };

    return (
        <div className="card p-3 my-3">
            <h4>📊 Risk Score Distribution Heatmap</h4>
            {loading ? (
                <p>Loading...</p>
            ) : Object.keys(distribution).length > 0 ? (
                <div style={{ height: "400px" }}>
                    <Bar data={chartData} options={options} />
                </div>
            ) : (
                <p>No risk data available</p>
            )}
        </div>
    );
};

export default RiskHeatmap;