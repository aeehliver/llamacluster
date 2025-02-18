// Historical data storage
let nodeHistoryData = {
    timestamps: [],
    nodeCount: []
};

// Maximum number of data points to keep
const MAX_HISTORY_POINTS = 100;

// Initialize historical chart
let historicalChart;

function initHistoricalChart() {
    const ctx = document.getElementById('historicalChart').getContext('2d');
    historicalChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Connected Nodes Over Time',
                data: [],
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Node Connection History'
                },
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Time'
                    }
                },
                y: {
                    display: true,
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Nodes'
                    }
                }
            }
        }
    });
}

function updateHistoricalData(activeNodes) {
    const now = new Date();
    nodeHistoryData.timestamps.push(now.toLocaleTimeString());
    nodeHistoryData.nodeCount.push(activeNodes);

    // Keep only the last MAX_HISTORY_POINTS data points
    if (nodeHistoryData.timestamps.length > MAX_HISTORY_POINTS) {
        nodeHistoryData.timestamps.shift();
        nodeHistoryData.nodeCount.shift();
    }

    // Update the chart
    historicalChart.data.labels = nodeHistoryData.timestamps;
    historicalChart.data.datasets[0].data = nodeHistoryData.nodeCount;
    historicalChart.update();
}

// Export functions for use in main dashboard
window.initHistoricalChart = initHistoricalChart;
window.updateHistoricalData = updateHistoricalData;