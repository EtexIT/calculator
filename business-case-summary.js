// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Initialize charts
    initializeCharts();
    
    // Load and process all saved data
    loadAndProcessData();
});

// Global chart variables
let cashFlowChart;
let accumulatedBenefitChart;

function loadAndProcessData() {
    // Load cost estimate data
    const costEstimate = JSON.parse(localStorage.getItem('costEstimate') || '{}');
    
    // Load savings data
    const savingsData = JSON.parse(localStorage.getItem('projectSavings') || '{}');
    
    // Update project info
    updateProjectInfo(costEstimate.projectInfo);
    
    // Process the data
    const processedData = processFinancialData(costEstimate, savingsData);
    
    // Update all displays
    updateDisplays(processedData);
}



function updateProjectInfo(projectInfo = {}) {
    // Update project information fields
    document.getElementById('projectTitle').textContent = projectInfo.name || '';
    document.getElementById('projectOwner').textContent = projectInfo.estimatedBy || '';
    document.getElementById('division').textContent = projectInfo.division || '';
}

function processFinancialData(costEstimate, savingsData) {
    // Extract costs from cost estimate
    const costs = {
        team: parseCurrency(costEstimate?.totals?.team || '€0.00'),
        tech: {
            oneTime: calculateOneTimeTechCosts(costEstimate?.techCosts || []),
            recurring: calculateRecurringTechCosts(costEstimate?.techCosts || [])
        },
        external: parseCurrency(costEstimate?.totals?.external || '€0.00'),
        risk: parseCurrency(costEstimate?.totals?.risk || '€0.00')
    };

    // Process savings data
    const oneOffSavings = processOneOffSavings(savingsData?.oneOff || []);
    const recurringSavings = processRecurringSavings(savingsData?.recurring || []);

    // Distribute costs properly
    const costDistribution = distributeProjectCosts(costs);
    
    // Calculate net flows and accumulated benefits
    const financialData = calculateFinancialMetrics(costDistribution, oneOffSavings, recurringSavings);
    
    return {
        costs: costDistribution,
        oneOffSavings,
        recurringSavings,
        ...financialData
    };
}

function calculateOneTimeTechCosts(techCosts) {
    return techCosts.reduce((total, cost) => {
        return total + parseCurrency(cost?.oneTime || '0');
    }, 0);
}

function calculateRecurringTechCosts(techCosts) {
    const monthlyTotals = techCosts.reduce((total, cost) => {
        const monthly = parseCurrency(cost?.monthly || '0');
        const duration = parseInt(cost?.duration || '0');
        return total + (monthly * duration);
    }, 0);
    
    // Convert to yearly cost
    return monthlyTotals * 12;
}

function distributeProjectCosts(costs) {
    // Initialize 5-year cost array
    const yearlyDistribution = [0, 0, 0, 0, 0];
    
    // Year 1: All one-time costs (team, one-time tech, external, risk)
    yearlyDistribution[0] = costs.team + 
                           costs.tech.oneTime + 
                           costs.external + 
                           costs.risk;
    
    // Distribute any recurring technology costs over the 5 years
    if (costs.tech.recurring > 0) {
        const yearlyRecurring = costs.tech.recurring / 5;
        yearlyDistribution.forEach((_, index) => {
            yearlyDistribution[index] += yearlyRecurring;
        });
    }
    
    return yearlyDistribution;
}

function calculateFinancialMetrics(costs, oneOffSavings, recurringSavings) {
    let accumulated = 0;
    const yearlyData = costs.map((cost, index) => {
        const yearlyNet = -cost + oneOffSavings[index] + recurringSavings[index];
        accumulated += yearlyNet;
        return {
            netFlow: yearlyNet,
            accumulated: accumulated
        };
    });

    const totalCosts = costs.reduce((a, b) => a + b, 0);
    const totalOneOff = oneOffSavings.reduce((a, b) => a + b, 0);
    const totalRecurring = recurringSavings.reduce((a, b) => a + b, 0);
    const netBenefit = totalOneOff + totalRecurring - totalCosts;
    
    // Calculate ROI based on total project costs
    const roi = totalCosts ? (netBenefit / totalCosts * 100) : 0;
    
    return {
        yearlyData,
        totalCosts,
        totalOneOff,
        totalRecurring,
        netBenefit,
        roi,
        paybackPeriod: calculatePaybackPeriod(yearlyData)
    };
}

function calculatePaybackPeriod(yearlyData) {
    let accumulated = 0;
    for (let i = 0; i < yearlyData.length; i++) {
        accumulated += yearlyData[i].netFlow;
        if (accumulated >= 0) {
            if (i === 0) {
                // If we break even in first year, calculate the fraction of the year
                return -accumulated / yearlyData[i].netFlow;
            } else {
                // For subsequent years, calculate the fraction of the year needed
                const previousAccumulated = accumulated - yearlyData[i].netFlow;
                const fraction = Math.abs(previousAccumulated) / Math.abs(yearlyData[i].netFlow);
                return i + fraction;
            }
        }
    }
    return 5; // If payback period is longer than 5 years
}

function calculateSCurveDistribution(total, months) {
    const distribution = Array(months).fill(0).map((_, i) => {
        const progress = (i + 0.5) / months;
        const weight = 1 / (1 + Math.exp(-10 * (progress - 0.5)));
        return total * weight / months;
    });
    
    // Ensure the sum matches the total exactly
    const sum = distribution.reduce((a, b) => a + b, 0);
    return distribution.map(value => (value / sum) * total);
}

function processOneOffSavings(oneOffData) {
    const total = oneOffData.reduce((sum, item) => sum + parseCurrency(item.amount || '0'), 0);
    // Put all one-off savings in first year
    return [total, 0, 0, 0, 0];
}

function processRecurringSavings(recurringData) {
    return [0, 1, 2, 3, 4].map(yearIndex => {
        return recurringData.reduce((sum, item) => {
            const yearValue = item[`year${yearIndex + 1}`] || '0';
            return sum + parseCurrency(yearValue);
        }, 0);
    });
}

function calculateFinancialMetrics(costs, oneOffSavings, recurringSavings) {
    let accumulated = 0;
    const yearlyData = costs.map((cost, index) => {
        const yearlyNet = -cost + oneOffSavings[index] + recurringSavings[index];
        accumulated += yearlyNet;
        return {
            netFlow: yearlyNet,
            accumulated: accumulated
        };
    });

    const totalCosts = costs.reduce((a, b) => a + b, 0);
    const totalOneOff = oneOffSavings.reduce((a, b) => a + b, 0);
    const totalRecurring = recurringSavings.reduce((a, b) => a + b, 0);
    const netBenefit = totalOneOff + totalRecurring - totalCosts;
    const roi = totalCosts ? (netBenefit / totalCosts * 100) : 0;
    
    return {
        yearlyData,
        totalCosts,
        totalOneOff,
        totalRecurring,
        netBenefit,
        roi,
        paybackPeriod: calculatePaybackPeriod(yearlyData)
    };
}

function calculatePaybackPeriod(yearlyData) {
    let accumulated = 0;
    for (let i = 0; i < yearlyData.length; i++) {
        accumulated += yearlyData[i].netFlow;
        if (accumulated >= 0) {
            // Calculate fractional year
            const previousAccumulated = accumulated - yearlyData[i].netFlow;
            const fraction = Math.abs(previousAccumulated) / Math.abs(yearlyData[i].netFlow);
            return i + fraction;
        }
    }
    return 5; // If payback period is longer than 5 years
}

function updateDisplays(data) {
    // Update key metrics
    document.getElementById('roiValue').textContent = `${data.roi.toFixed(1)}%`;
    document.getElementById('paybackPeriod').textContent = `${data.paybackPeriod.toFixed(1)} years`;
    document.getElementById('netBenefit').textContent = formatCurrency(data.netBenefit);
    
    // Update financial table
    updateFinancialTable(data);
    
    // Update charts
    updateCharts(data);
}

function updateFinancialTable(data) {
    const tbody = document.getElementById('financialOverview');
    tbody.innerHTML = '';

    data.yearlyData.forEach((yearData, index) => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td class="border p-2">Year ${index + 1}</td>
            <td class="border p-2">${formatCurrency(data.costs[index])}</td>
            <td class="border p-2">${formatCurrency(data.oneOffSavings[index])}</td>
            <td class="border p-2">${formatCurrency(data.recurringSavings[index])}</td>
            <td class="border p-2">${formatCurrency(yearData.netFlow)}</td>
            <td class="border p-2">${formatCurrency(yearData.accumulated)}</td>
        `;
    });

    // Update totals
    document.getElementById('totalCosts').textContent = formatCurrency(data.totalCosts);
    document.getElementById('totalOneOffSavings').textContent = formatCurrency(data.totalOneOff);
    document.getElementById('totalRecurringSavings').textContent = formatCurrency(data.totalRecurring);
    document.getElementById('totalNetCashFlow').textContent = formatCurrency(data.netBenefit);
    document.getElementById('finalAccumulatedBenefit').textContent = formatCurrency(data.yearlyData[4].accumulated);
}

function updateCharts(data) {
    // Update cash flow chart
    cashFlowChart.data.datasets[0].data = data.costs.map(cost => -cost);
    cashFlowChart.data.datasets[1].data = data.oneOffSavings;
    cashFlowChart.data.datasets[2].data = data.recurringSavings;
    cashFlowChart.update();

    // Update accumulated benefit chart
    accumulatedBenefitChart.data.datasets[0].data = data.yearlyData.map(year => year.accumulated);
    accumulatedBenefitChart.update();
}

function initializeCharts() {
    // Cash flow chart initialization
    const cashFlowCtx = document.getElementById('cashFlowChart').getContext('2d');
    cashFlowChart = new Chart(cashFlowCtx, {
        type: 'bar',
        data: {
            labels: ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'],
            datasets: [
                {
                    label: 'Costs',
                    data: [],
                    backgroundColor: '#EF4444'
                },
                {
                    label: 'One-off Savings',
                    data: [],
                    backgroundColor: '#22C55E'
                },
                {
                    label: 'Recurring Savings',
                    data: [],
                    backgroundColor: '#3B82F6'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: true },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: {
                        callback: value => formatCurrency(value)
                    }
                }
            }
        }
    });

    // Accumulated benefit chart initialization
    const benefitCtx = document.getElementById('accumulatedBenefitChart').getContext('2d');
    accumulatedBenefitChart = new Chart(benefitCtx, {
        type: 'line',
        data: {
            labels: ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'],
            datasets: [{
                label: 'Accumulated Benefit',
                data: [],
                borderColor: '#A855F7',
                backgroundColor: 'rgba(168, 85, 247, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => formatCurrency(value)
                    }
                }
            }
        }
    });
}

function parseCurrency(value) {
    return parseFloat(value.replace(/[^0-9.-]+/g, '')) || 0;
}

function formatCurrency(amount) {
    return `€${amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}

// Add this new function to business-case-summary.js
function resetBusinessCase() {
    // Show confirmation dialog
    if (confirm('Are you sure you want to reset all calculations? This will clear all saved cost and savings data.')) {
        // Clear all localStorage items
        localStorage.removeItem('costEstimate');
        localStorage.removeItem('projectSavings');
        localStorage.removeItem('businessCase');

        // Reset project info
        document.getElementById('projectTitle').textContent = '';
        document.getElementById('projectOwner').textContent = '';
        document.getElementById('division').textContent = '';

        // Reset key metrics
        document.getElementById('roiValue').textContent = '0%';
        document.getElementById('paybackPeriod').textContent = '0 years';
        document.getElementById('netBenefit').textContent = '€0.00';

        // Reset financial table
        const tbody = document.getElementById('financialOverview');
        tbody.innerHTML = '';
        for (let i = 1; i <= 5; i++) {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td class="border p-2">Year ${i}</td>
                <td class="border p-2">€0.00</td>
                <td class="border p-2">€0.00</td>
                <td class="border p-2">€0.00</td>
                <td class="border p-2">€0.00</td>
                <td class="border p-2">€0.00</td>
            `;
        }

        // Reset totals
        document.getElementById('totalCosts').textContent = '€0.00';
        document.getElementById('totalOneOffSavings').textContent = '€0.00';
        document.getElementById('totalRecurringSavings').textContent = '€0.00';
        document.getElementById('totalNetCashFlow').textContent = '€0.00';
        document.getElementById('finalAccumulatedBenefit').textContent = '€0.00';

        // Reset charts
        if (cashFlowChart) {
            cashFlowChart.data.datasets[0].data = Array(5).fill(0);
            cashFlowChart.data.datasets[1].data = Array(5).fill(0);
            cashFlowChart.data.datasets[2].data = Array(5).fill(0);
            cashFlowChart.update();
        }

        if (accumulatedBenefitChart) {
            accumulatedBenefitChart.data.datasets[0].data = Array(5).fill(0);
            accumulatedBenefitChart.update();
        }

        // Show reset confirmation to user
        const toast = document.createElement('div');
        toast.className = 'fixed bottom-4 right-4 bg-blue-500 text-white px-6 py-3 rounded-md shadow-lg';
        toast.textContent = 'All calculations have been reset';
        document.body.appendChild(toast);

        // Remove toast after 3 seconds
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
}