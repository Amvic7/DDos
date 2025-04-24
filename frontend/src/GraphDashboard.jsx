// src/GraphDashboard.jsx
import React, { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import socket from "./socket"; // Shared socket instance

import {
    Chart as ChartJS,
    LineElement,
    CategoryScale,
    LinearScale,
    PointElement,
    Legend,
    Tooltip,
} from "chart.js";

ChartJS.register(
    LineElement,
    CategoryScale,
    LinearScale,
    PointElement,
    Legend,
    Tooltip
);

const GraphDashboard = () => {

    const chartOptions = {
        plugins: {
            tooltip: {
                callbacks: {
                    title: (tooltipItems) => {
                        const index = tooltipItems[0].dataIndex;
                        return rawLabels[index]; // Shows the full ISO timestamp
                    },
                },
            },
        },
    };
    
    
    const [requestData, setRequestData] = useState({
        labels: [],
        datasets: [],
    });

    const [banData, setBanData] = useState({
        labels: [],
        datasets: [],
    });
    
    const [rawLabels, setRawLabels] = useState([]);


    useEffect(() => {
        const handleGraphData = (data) => {
            console.log("GRAPH DATA RECEIVED:", data);
        
            const rawLabels = Array.from(
                new Set([
                    ...Object.keys(data.requests || {}),
                    ...Object.keys(data.bans || {}),
                ])
            ).sort();
        
            setRawLabels(rawLabels); // ✅ Move this here, after rawLabels is defined
        
            const labelMap = rawLabels.reduce((acc, isoString) => {
                const date = new Date(isoString);
                const displayLabel = date.toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                });
                acc[isoString] = displayLabel;
                return acc;
            }, {});
        
            const formattedLabels = rawLabels.map((ts) => labelMap[ts]);
        
            setRequestData({
                labels: formattedLabels,
                datasets: [
                    {
                        label: "Requests per Minute",
                        data: rawLabels.map((label) => data.requests?.[label] || 0),
                        borderColor: "blue",
                        fill: false,
                        tension: 0.3,
                    },
                ],
            });
        
            setBanData({
                labels: formattedLabels,
                datasets: [
                    {
                        label: "Bans per Minute",
                        data: rawLabels.map((label) => data.bans?.[label] || 0),
                        borderColor: "red",
                        fill: false,
                        tension: 0.3,
                    },
                ],
            });
        };
        
        
        
        

        socket.on("updateGraphData", handleGraphData);

        return () => {
            socket.off("updateGraphData", handleGraphData);
        };
    }, []);

    return (
        <div style={{ padding: "2rem" }}>
            <h2>📈 Request Timeline</h2>
            <div style={{ width: "100%", height: "400px" }}>
                <Line data={requestData} options={chartOptions} />
            </div>

            <h2 style={{ marginTop: "3rem" }}>🚫 Ban Timeline</h2>
            <div style={{ width: "100%", height: "400px" }}>
                <Line data={banData} options={chartOptions} />
            </div>
        </div>
    );
};

export default GraphDashboard;
