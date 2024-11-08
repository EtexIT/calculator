document.addEventListener('DOMContentLoaded', function() {
    // Load project information
    loadProjectInfo();
    
    // Initialize charts first
    initializeCharts();
    
    // Load financial data and calculate metrics
    loadFinancialData();
    
    // Add button event listeners
    document.getElementById('saveBusinessCase').addEventListener('click', saveBusinessCase);
    document.getElementById('resetBusinessCase').addEventListener('click', resetBusinessCase);
    document.getElementById('exportPDF').addEventListener('click', exportPDF);
});

function loadFinancialData() {
    // Load costs from localStorage
    const costs = JSON.parse(localStorage.getItem('projectCosts') || '{}');
    // Load values from localStorage
    const values = JSON.parse(localStorage.getItem('projectValue') || '{}');
    
    if (Object.keys(costs).length === 0 || Object.keys(values).length === 0) {
        showIncompleteDataMessage();
        return;
    }

    calculateFinancialMetrics(costs, values);
}

function processYearlyData(costs, values) {
    let yearlyData = Array(5).fill(null).map(() => ({
        costs: 0,
        oneOffValue: 0,
        recurringValue: 0,
        netFlow: 0,
        accumulated: 0
    }));

    // Process costs
    // Team costs
    if (costs.teamCosts) {
        // Total team costs from localStorage
        const totalTeamCosts = costs.teamCosts.reduce((sum, member) => {
            const daysTotal = (parseFloat(member.validationDays) || 0) +
                            (parseFloat(member.scopingDays) || 0) +
                            (parseFloat(member.executionDays) || 0);
            const persons = parseFloat(member.persons) || 0;
            const rate = parseFloat(member.rate) || 0;
            const contingency = (parseFloat(member.contingency) || 0) / 100;
            
            return sum + (daysTotal * persons * rate * (1 + contingency));
        }, 0);
        
        // Add to first year costs
        yearlyData[0].costs += totalTeamCosts;
    }

    // Technology costs
    if (costs.techCosts) {
        costs.techCosts.forEach(tech => {
            // One-time tech costs
            const oneTime = parseFloat(tech['tech-onetime']) || 0;
            yearlyData[0].costs += oneTime;
            
            // Monthly tech costs
            const monthly = parseFloat(tech['tech-monthly']) || 0;
            const duration = parseFloat(tech['tech-duration']) || 0;
            
            // Distribute monthly costs across years
            for (let i = 0; i < Math.min(duration/12, 5); i++) {
                yearlyData[i].costs += monthly * 12;
            }
        });
    }

    // External costs
    if (costs.externalCosts) {
        const totalExternalCosts = costs.externalCosts.reduce((sum, external) => {
            const cost = parseFloat(external['external-cost']) || 0;
            const contingency = (parseFloat(external['external-contingency']) || 0) / 100;
            return sum + (cost * (1 + contingency));
        }, 0);
        
        // Add external costs to first year
        yearlyData[0].costs += totalExternalCosts;
    }

    // Process values
    if (values.oneOff) {
        const oneOffTotal = values.oneOff.reduce((sum, item) => {
            return sum + (parseFloat(item.amount) || 0);
        }, 0);
        yearlyData[0].oneOffValue = oneOffTotal;
    }

    if (values.recurring) {
        values.recurring.forEach(recurring => {
            for (let i = 1; i <= 5; i++) {
                yearlyData[i-1].recurringValue += parseFloat(recurring[`year${i}`]) || 0;
            }
        });
    }

    // Apply risk adjustment from assessment if available
    const assessment = JSON.parse(localStorage.getItem('projectAssessment') || '{}');
    if (assessment.riskAdjustment) {
        const riskPercentage = parseFloat(assessment.riskAdjustment) / 100;
        yearlyData.forEach(year => {
            year.costs *= (1 + riskPercentage);
        });
    }

    // Calculate net flow and accumulated values
    let accumulated = 0;
    yearlyData.forEach((year, index) => {
        year.netFlow = year.oneOffValue + year.recurringValue - year.costs;
        accumulated += year.netFlow;
        year.accumulated = accumulated;
    });

    return yearlyData;
}

function updateFinancialTable(yearlyData) {
    const tbody = document.querySelector('#financialOverview tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    let totals = {
        costs: 0,
        oneOff: 0,
        recurring: 0,
        netFlow: 0
    };

    yearlyData.forEach((year, index) => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>Year ${index + 1}</td>
            <td>${formatCurrency(year.costs)}</td>
            <td>${formatCurrency(year.oneOffValue)}</td>
            <td>${formatCurrency(year.recurringValue)}</td>
            <td>${formatCurrency(year.netFlow)}</td>
            <td>${formatCurrency(year.accumulated)}</td>
        `;

        totals.costs += year.costs;
        totals.oneOff += year.oneOffValue;
        totals.recurring += year.recurringValue;
        totals.netFlow += year.netFlow;
    });

    // Add totals row
    const totalsRow = tbody.insertRow();
    totalsRow.innerHTML = `
        <td><strong>Total</strong></td>
        <td><strong>${formatCurrency(totals.costs)}</strong></td>
        <td><strong>${formatCurrency(totals.oneOff)}</strong></td>
        <td><strong>${formatCurrency(totals.recurring)}</strong></td>
        <td><strong>${formatCurrency(totals.netFlow)}</strong></td>
        <td><strong>${formatCurrency(yearlyData[yearlyData.length-1].accumulated)}</strong></td>
    `;
}

function updateKeyMetrics(yearlyData) {
    const totalCosts = yearlyData.reduce((sum, year) => sum + year.costs, 0);
    const totalBenefits = yearlyData.reduce((sum, year) => sum + year.oneOffValue + year.recurringValue, 0);
    
    // Calculate ROI
    const roi = totalCosts > 0 ? ((totalBenefits - totalCosts) / totalCosts * 100) : 0;
    
    // Calculate Payback Period
    const payback = calculatePaybackPeriod(yearlyData);
    
    // Calculate Net Benefit
    const netBenefit = totalBenefits - totalCosts;

    // Update display
    document.getElementById('roiValue').textContent = `${roi.toFixed(1)}%`;
    // Add "Year(s)" to payback period display
    document.getElementById('paybackPeriod').textContent = payback < 5 ? 
        `${payback.toFixed(1)} Year(s)` : 
        '>5 Years';
    document.getElementById('netBenefit').textContent = formatCurrency(netBenefit);
}

function calculateFinancialMetrics(costs, values) {
    // Process yearly data
    const yearlyData = processYearlyData(costs, values);
    
    // Update table
    updateFinancialTable(yearlyData);
    
    // Calculate and update key metrics
    updateKeyMetrics(yearlyData);
    
    // Update charts
    updateCharts(yearlyData);
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-EU', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount)
    .replace('EUR', '€');
}

function parseCurrency(value) {
    if (!value) return 0;
    return parseFloat(value.replace(/[^0-9.-]+/g, '')) || 0;
}
let cashFlowChart;
let accumulatedBenefitChart;

function calculatePaybackPeriod(yearlyData) {
    let accumulated = 0;
    for (let i = 0; i < yearlyData.length; i++) {
        accumulated += yearlyData[i].netFlow;
        if (accumulated >= 0) {
            // If we recover the investment in the first year
            if (i === 0) {
                // Only calculate partial year if we have positive net flow
                return yearlyData[i].netFlow > 0 ? 
                    (yearlyData[i].costs / yearlyData[i].netFlow) : 5;
            }
            // Calculate fraction of year when we break even
            const previousAccumulated = accumulated - yearlyData[i].netFlow;
            return i + (Math.abs(previousAccumulated) / Math.abs(yearlyData[i].netFlow));
        }
    }
    return 5; // If payback period is longer than 5 years
}

function initializeCharts() {
    const cashFlowCtx = document.getElementById('cashFlowChart');
    const accumulatedCtx = document.getElementById('accumulatedBenefitChart');

    if (!cashFlowCtx || !accumulatedCtx) {
        console.warn('Chart canvas elements not found');
        return;
    }

    // Initialize Cash Flow Chart
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
                    label: 'One-off Value',
                    data: [],
                    backgroundColor: '#22C55E'
                },
                {
                    label: 'Recurring Value',
                    data: [],
                    backgroundColor: '#3B82F6'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 1.5,
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

    // Initialize Accumulated Benefit Chart
    accumulatedBenefitChart = new Chart(accumulatedCtx, {
        type: 'line',
        data: {
            labels: ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'],
            datasets: [{
                label: 'Accumulated Benefit',
                data: [],
                borderColor: '#F06D0D',
                backgroundColor: 'rgba(240, 109, 13, 0.1)',
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 1.5,
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

function updateCharts(yearlyData) {
    if (!cashFlowChart || !accumulatedBenefitChart) {
        console.warn('Charts not initialized');
        return;
    }

    // Update Cash Flow Chart
    cashFlowChart.data.datasets[0].data = yearlyData.map(year => -year.costs);
    cashFlowChart.data.datasets[1].data = yearlyData.map(year => year.oneOffValue);
    cashFlowChart.data.datasets[2].data = yearlyData.map(year => year.recurringValue);
    cashFlowChart.update();

    // Update Accumulated Benefit Chart
    accumulatedBenefitChart.data.datasets[0].data = yearlyData.map(year => year.accumulated);
    accumulatedBenefitChart.update();
}

function saveBusinessCase() {
    // Implementation will be added later
    console.log('Save business case clicked');
}

function resetBusinessCase() {
    if (confirm('Are you sure you want to reset all business case data? This will reset all costs and value data.')) {
        // Remove all stored data
        localStorage.removeItem('projectCosts');
        localStorage.removeItem('projectValue');
        
        // Reset metrics to default values
        document.getElementById('roiValue').textContent = '0%';
        document.getElementById('paybackPeriod').textContent = '0 Year(s)';
        document.getElementById('netBenefit').textContent = '€0.00';

        // Reset the table content
        const tbody = document.querySelector('#financialOverview tbody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td>Year 1</td>
                    <td>€0.00</td>
                    <td>€0.00</td>
                    <td>€0.00</td>
                    <td>€0.00</td>
                    <td>€0.00</td>
                </tr>
                <tr>
                    <td>Year 2</td>
                    <td>€0.00</td>
                    <td>€0.00</td>
                    <td>€0.00</td>
                    <td>€0.00</td>
                    <td>€0.00</td>
                </tr>
                <tr>
                    <td>Year 3</td>
                    <td>€0.00</td>
                    <td>€0.00</td>
                    <td>€0.00</td>
                    <td>€0.00</td>
                    <td>€0.00</td>
                </tr>
                <tr>
                    <td>Year 4</td>
                    <td>€0.00</td>
                    <td>€0.00</td>
                    <td>€0.00</td>
                    <td>€0.00</td>
                    <td>€0.00</td>
                </tr>
                <tr>
                    <td>Year 5</td>
                    <td>€0.00</td>
                    <td>€0.00</td>
                    <td>€0.00</td>
                    <td>€0.00</td>
                    <td>€0.00</td>
                </tr>
                <tr>
                    <td><strong>Total</strong></td>
                    <td><strong>€0.00</strong></td>
                    <td><strong>€0.00</strong></td>
                    <td><strong>€0.00</strong></td>
                    <td><strong>€0.00</strong></td>
                    <td><strong>€0.00</strong></td>
                </tr>
            `;
        }

        // Reset charts
        if (cashFlowChart) {
            cashFlowChart.data.datasets.forEach(dataset => {
                dataset.data = Array(5).fill(0);
            });
            cashFlowChart.update();
        }
        if (accumulatedBenefitChart) {
            accumulatedBenefitChart.data.datasets[0].data = Array(5).fill(0);
            accumulatedBenefitChart.update();
        }

        // Show message to user
        alert('All data has been reset. Please go to Costs and Value pages to enter new data.');

        // Redirect to costs page after short delay
        setTimeout(() => {
            window.location.href = 'assessment.html';
        }, 500);
    }
}

function exportPDF() {
    // Implementation will be added later
    console.log('Export PDF clicked');
}

function showIncompleteDataMessage() {
    const container = document.querySelector('.business-case-container');
    container.innerHTML = `
        <div class="alert alert-warning">
            <h2>Incomplete Data</h2>
            <p>Please complete both cost estimation and value analysis first.</p>
            <div class="btn-group">
                <a href="costs.html" class="btn-primary">Go to Costs</a>
                <a href="value.html" class="btn-primary">Go to Value</a>
            </div>
        </div>
    `;
}

function loadProjectInfo() {
    const assessment = JSON.parse(localStorage.getItem('projectAssessment') || '{}');

    if (Object.keys(assessment).length === 0) {
        showNoAssessmentMessage();
        return;
    }

    document.getElementById('summaryProjectName').textContent = assessment.projectName || 'No project name';
    document.getElementById('summaryProjectOwner').textContent = assessment.projectOwner || 'No owner specified';
    document.getElementById('summaryDepartment').textContent = assessment.department || 'No department specified';
    document.getElementById('summaryEstimatedBy').textContent = assessment.estimatedBy || 'Not specified';
}

function showNoAssessmentMessage() {
    const container = document.querySelector('.business-case-container');
    container.innerHTML = `
        <div class="alert alert-warning">
            <h2>No Assessment Data Found</h2>
            <p>Please complete the project assessment first.</p>
            <a href="assessment.html" class="btn-primary">Go to Assessment</a>
        </div>
    `;
}