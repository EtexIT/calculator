// Global chart variables
let costDistributionChart;
let monthlyProjectionChart;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Set default date to today
    document.getElementById('estimationDate').valueAsDate = new Date();
    
    // Initialize charts
    initializeCharts();
    
    // Add CAPEX checkbox listener
    document.getElementById('isCapexProject').addEventListener('change', calculateTotals);
    
    // Add event listeners to all input fields including new phase inputs
    document.querySelectorAll('input[type="number"], select').forEach(input => {
        input.addEventListener('input', calculateTotals);
    });

    // Load any saved data
    loadSavedEstimate();
});

function initializeCharts() {
    // Existing cost distribution chart initialization
    const costCtx = document.getElementById('costDistributionChart').getContext('2d');
    costDistributionChart = new Chart(costCtx, {
        type: 'pie',
        data: {
            labels: ['Team Costs', 'Technology Costs', 'External Costs', 'Risk Adjustment'],
            datasets: [{
                data: [0, 0, 0, 0],
                backgroundColor: ['#FF6B35', '#6B98B2', '#004E89', '#FFB563']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Cost Distribution'
                },
                legend: {
                    position: 'bottom'
                }
            }
        }
    });

    // Monthly projection chart
    const monthlyCtx = document.getElementById('monthlyProjectionChart').getContext('2d');
    monthlyProjectionChart = new Chart(monthlyCtx, {
        type: 'bar',
        data: {
            labels: ['Month 1'],
            datasets: [{
                label: 'Monthly Cost Projection',
                data: [0],
                backgroundColor: '#FF6B35'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Monthly Cost Projection'
                },
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Cost (€)'
                    },
                    ticks: {
                        callback: function(value) {
                            return '€' + value.toLocaleString();
                        }
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Project Timeline'
                    }
                }
            }
        }
    });
}

function calculateMonthlyDistribution(totalCost, duration) {
    const months = Math.max(duration, 1);
    const labels = Array.from({length: months}, (_, i) => `Month ${i + 1}`);
    
    // Calculate S-curve distribution for project costs
    const values = Array.from({length: months}, (_, i) => {
        const progress = (i + 0.5) / months;
        const weight = 1 / (1 + Math.exp(-10 * (progress - 0.5)));
        return weight;
    });
    
    // Normalize to total cost
    const sum = values.reduce((a, b) => a + b, 0);
    const normalizedValues = values.map(v => (v / sum) * totalCost);
    
    return {
        labels: labels,
        values: normalizedValues.map(v => Math.round(v * 100) / 100)
    };
}
// keep
function calculateTotals() {
    const isCapex = document.getElementById('isCapexProject').checked;
    const teamCostData = calculateTeamCosts();
    const techCostData = calculateTechnologyCosts();
    const externalTotal = calculateExternalCosts();
    
    // Calculate risk adjustment
    const baseTotal = teamCostData.total + techCostData.total + externalTotal;
    const riskPercentage = parseFloat(document.getElementById('riskScore').value) || 0;
    const riskAdjustment = baseTotal * (riskPercentage / 100);
    
    // Update risk adjustment display
    const riskAdjustmentElement = document.getElementById('riskAdjustment');
if (riskAdjustmentElement) {
    riskAdjustmentElement.textContent = `Risk Adjustment: ${formatCurrency(riskAdjustment)}`;
}
    
    // Calculate CAPEX/OPEX split
    const capexOpexSplit = calculateCapexOpexSplit(
        teamCostData,
        techCostData,
        externalTotal,
        riskAdjustment,
        isCapex
    );

    // Update displays and charts
    updateDisplays(teamCostData, techCostData, externalTotal, riskAdjustment, capexOpexSplit);
    updateCharts(teamCostData, techCostData.total, externalTotal, riskAdjustment, capexOpexSplit);
}

function calculateCapexOpexSplit(teamCosts, techCosts, externalTotal, riskAdjustment, isCapex) {
    if (!isCapex) {
        return {
            capex: 0,
            opex: teamCosts.total + techCosts.total + externalTotal + riskAdjustment
        };
    }

    // CAPEX calculations
    const capexTeamCosts = teamCosts.phases.preparation + teamCosts.phases.execution;
    const capexTechCosts = techCosts.oneTime;
    const capexTotal = capexTeamCosts + capexTechCosts + externalTotal;

    // OPEX calculations
    const opexTeamCosts = teamCosts.phases.validation;
    const opexTechCosts = techCosts.recurring;
    const opexTotal = opexTeamCosts + opexTechCosts;

    // Distribute risk adjustment proportionally
    const totalBeforeRisk = capexTotal + opexTotal;
    const capexRisk = totalBeforeRisk > 0 ? (capexTotal / totalBeforeRisk) * riskAdjustment : 0;
    const opexRisk = totalBeforeRisk > 0 ? (opexTotal / totalBeforeRisk) * riskAdjustment : 0;

    return {
        capex: capexTotal + capexRisk,
        opex: opexTotal + opexRisk
    };
}

function updateDisplays(teamCosts, techCosts, externalTotal, riskAdjustment, capexOpexSplit) {
    // Update main summaries with proper formatting
    document.getElementById('summaryTeamCosts').textContent = formatCurrency(teamCosts.total);
    document.getElementById('summaryTechCosts').textContent = formatCurrency(techCosts.total);
    document.getElementById('summaryExternalCosts').textContent = formatCurrency(externalTotal);
    document.getElementById('summaryRiskAdjustment').textContent = formatCurrency(riskAdjustment);
    
    // Update CAPEX/OPEX totals
    document.getElementById('totalCapex').textContent = formatCurrency(capexOpexSplit.capex);
    document.getElementById('totalOpex').textContent = formatCurrency(capexOpexSplit.opex);
    
    // Update grand total
    const grandTotal = capexOpexSplit.capex + capexOpexSplit.opex;
    document.getElementById('totalCost').textContent = formatCurrency(grandTotal);
}


function calculateTechnologyCosts() {
    let oneTime = 0;
    let recurring = 0;
    let total = 0;

    document.querySelectorAll('#techCostsTable tbody tr').forEach(row => {
        const oneTimeCost = parseFloat(row.querySelector('.tech-onetime').value) || 0;
        const monthly = parseFloat(row.querySelector('.tech-monthly').value) || 0;
        const duration = parseFloat(row.querySelector('.tech-duration').value) || 0;
        
        oneTime += oneTimeCost;
        recurring += monthly * duration;
        
        const rowTotal = oneTimeCost + (monthly * duration);
        total += rowTotal;
        row.querySelector('.total').textContent = `€${rowTotal.toFixed(2)}`;
    });

    document.getElementById('totalTechCosts').textContent = `€${total.toFixed(2)}`;
    
    return {
        total: total,
        oneTime: oneTime,
        recurring: recurring
    };
}
function calculateExternalCosts() {
    let total = 0;
    document.querySelectorAll('#externalCostsTable tbody tr').forEach(row => {
        const cost = parseFloat(row.querySelector('.external-cost').value) || 0;
        const contingency = parseFloat(row.querySelector('.external-contingency').value) || 0;
        
        const rowTotal = cost * (1 + contingency/100);
        total += rowTotal;
        row.querySelector('.total').textContent = `€${rowTotal.toFixed(2)}`;
    });
    document.getElementById('totalExternalCosts').textContent = `€${total.toFixed(2)}`;
    return total;
}

function updateCharts(teamCosts, techTotal, externalTotal, riskAdjustment, capexOpexSplit) {
    // Update cost distribution pie chart - keep only the main cost categories
    costDistributionChart.data.datasets = [{
        data: [
            teamCosts.total,
            techTotal,
            externalTotal,
            riskAdjustment
        ],
        backgroundColor: ['#FF6B35', '#6B98B2', '#004E89', '#FFB563']
    }];
    
    // Keep only the main cost category labels
    costDistributionChart.data.labels = ['Team Costs', 'Technology Costs', 'External Costs', 'Risk Adjustment'];
    costDistributionChart.update();

    // Calculate project duration
    const teamDurations = Array.from(document.querySelectorAll('.days-validation, .days-preparation, .days-execution'))
        .map(input => parseFloat(input.value) || 0);
    const maxTeamDays = teamDurations.reduce((sum, days) => sum + days, 0);
    
    const techDurations = Array.from(document.querySelectorAll('.tech-duration'))
        .map(input => parseFloat(input.value) || 0);
    const maxTechMonths = Math.max(...techDurations);
    
    // Convert team days to months (21 working days per month) and compare with tech duration
    const teamMonths = Math.ceil(maxTeamDays / 21);
    const totalDuration = Math.max(teamMonths, maxTechMonths, 1);

    // Calculate monthly distribution
    const totalCost = teamCosts.total + techTotal + externalTotal + riskAdjustment;
    const monthlyData = calculateMonthlyDistribution(totalCost, totalDuration);

    // Update monthly projection chart
    monthlyProjectionChart.data.labels = monthlyData.labels;
    monthlyProjectionChart.data.datasets = [{
        label: 'Monthly Cost Projection',
        data: monthlyData.values,
        backgroundColor: '#FF6B35'
    }];

    monthlyProjectionChart.options.scales.y.ticks = {
        callback: function(value) {
            return '€' + value.toLocaleString();
        }
    };

    monthlyProjectionChart.update();
}

function saveEstimate() {
    const formData = {
        projectInfo: {
            name: document.getElementById('projectName').value,
            estimatedBy: document.getElementById('estimatedBy').value,
            date: document.getElementById('estimationDate').value,
            isCapex: document.getElementById('isCapexProject').checked
        },
        teamCosts: Array.from(document.querySelectorAll('#teamCostsTable tbody tr')).map(row => ({
            role: row.cells[0].textContent,
            rate: row.querySelector('.rate').value,
            validationDays: row.querySelector('.days-validation').value,
            preparationDays: row.querySelector('.days-preparation').value,
            executionDays: row.querySelector('.days-execution').value,
            contingency: row.querySelector('.contingency').value,
            total: row.querySelector('.total').textContent
        })),
        techCosts: Array.from(document.querySelectorAll('#techCostsTable tbody tr')).map(row => ({
            item: row.cells[0].textContent,
            oneTime: row.querySelector('.tech-onetime').value,
            monthly: row.querySelector('.tech-monthly').value,
            duration: row.querySelector('.tech-duration').value,
            total: row.querySelector('.total').textContent
        })),
        externalCosts: Array.from(document.querySelectorAll('#externalCostsTable tbody tr')).map(row => ({
            item: row.cells[0].textContent,
            cost: row.querySelector('.external-cost').value,
            contingency: row.querySelector('.external-contingency').value,
            total: row.querySelector('.total').textContent
        })),
        riskScore: document.getElementById('riskScore').value,
        totals: {
            team: document.getElementById('summaryTeamCosts').textContent,
            tech: document.getElementById('summaryTechCosts').textContent,
            external: document.getElementById('summaryExternalCosts').textContent,
            risk: document.getElementById('summaryRiskAdjustment').textContent,
            grand: document.getElementById('totalCost').textContent
        }
    };

    localStorage.setItem('costEstimate', JSON.stringify(formData));

    const saveIndicator = document.getElementById('saveIndicator');
    saveIndicator.style.display = 'block';
    setTimeout(() => {
        saveIndicator.style.display = 'none';
    }, 3000);
}

function loadSavedEstimate() {
    const saved = localStorage.getItem('costEstimate');
    if (saved) {
        const data = JSON.parse(saved);
        
        // Load project info
        document.getElementById('projectName').value = data.projectInfo.name;
        document.getElementById('estimatedBy').value = data.projectInfo.estimatedBy;
        document.getElementById('estimationDate').value = data.projectInfo.date;
        document.getElementById('isCapexProject').checked = data.projectInfo.isCapex;

        // Load team costs
        data.teamCosts.forEach((cost, index) => {
            const row = document.querySelectorAll('#teamCostsTable tbody tr')[index];
            if (row) {
                row.querySelector('.rate').value = cost.rate;
                row.querySelector('.days-validation').value = cost.validationDays;
                row.querySelector('.days-preparation').value = cost.preparationDays;
                row.querySelector('.days-execution').value = cost.executionDays;
                row.querySelector('.contingency').value = cost.contingency;
            }
        });

        // Load technology costs
        data.techCosts.forEach((cost, index) => {
            const row = document.querySelectorAll('#techCostsTable tbody tr')[index];
            if (row) {
                row.querySelector('.tech-onetime').value = cost.oneTime;
                row.querySelector('.tech-monthly').value = cost.monthly;
                row.querySelector('.tech-duration').value = cost.duration;
            }
        });

        // Load external costs
        data.externalCosts.forEach((cost, index) => {
            const row = document.querySelectorAll('#externalCostsTable tbody tr')[index];
            if (row) {
                row.querySelector('.external-cost').value = cost.cost;
                row.querySelector('.external-contingency').value = cost.contingency;
            }
        });

        // Load risk score
        document.getElementById('riskScore').value = data.riskScore;

        // Recalculate everything
        calculateTotals();
    }
}

// Utility function for formatting currency
function formatCurrency(amount) {
    return `€${Number(amount).toFixed(2)}`;
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Add input event listeners for one-off savings
    document.querySelectorAll('#oneOffTable input').forEach(input => {
        input.addEventListener('input', calculateOneOffSavings);
    });

    // Add input event listeners for recurring savings
    document.querySelectorAll('#recurringTable input').forEach(input => {
        input.addEventListener('input', calculateRecurringSavings);
    });

    // Initialize calculations
    calculateOneOffSavings();
    calculateRecurringSavings();
});

function calculateOneOffSavings() {
    let total = 0;
    
    // Calculate total for each row
    document.querySelectorAll('#oneOffTable tbody tr').forEach(row => {
        const amount = parseFloat(row.querySelector('.amount').value) || 0;
        total += amount;
        
        // Update row total if there's a total cell
        const totalCell = row.querySelector('.row-total');
        if (totalCell) {
            totalCell.textContent = formatCurrency(amount);
        }
    });
    
    // Update total one-off savings
    document.getElementById('totalOneOffSavings').textContent = formatCurrency(total);
    
    // Update summary
    document.getElementById('summaryOneOffSavings').textContent = formatCurrency(total);
    updateTotalProjectSavings();
}

function calculateRecurringSavings() {
    let yearlyTotals = [0, 0, 0, 0, 0]; // Array for 5 years
    
    // Calculate totals for each row
    document.querySelectorAll('#recurringTable tbody tr').forEach(row => {
        // Get values for each year
        const year1 = parseFloat(row.querySelector('.year1').value) || 0;
        const year2 = parseFloat(row.querySelector('.year2').value) || 0;
        const year3 = parseFloat(row.querySelector('.year3').value) || 0;
        const year4 = parseFloat(row.querySelector('.year4').value) || 0;
        const year5 = parseFloat(row.querySelector('.year5').value) || 0;
        
        // Add to yearly totals
        yearlyTotals[0] += year1;
        yearlyTotals[1] += year2;
        yearlyTotals[2] += year3;
        yearlyTotals[3] += year4;
        yearlyTotals[4] += year5;
    });
    
    // Update yearly totals in the table
    yearlyTotals.forEach((total, index) => {
        document.getElementById(`yearTotal${index + 1}`).textContent = formatCurrency(total);
    });
    
    // Calculate and update total recurring savings
    const totalRecurring = yearlyTotals.reduce((sum, current) => sum + current, 0);
    document.getElementById('summaryRecurringSavings').textContent = formatCurrency(totalRecurring);
    
    updateTotalProjectSavings();
}

function updateTotalProjectSavings() {
    // Get values from summary
    const oneOffTotal = parseCurrency(document.getElementById('summaryOneOffSavings').textContent);
    const recurringTotal = parseCurrency(document.getElementById('summaryRecurringSavings').textContent);
    
    // Calculate and update total project savings
    const totalSavings = oneOffTotal + recurringTotal;
    document.getElementById('totalProjectSavings').textContent = formatCurrency(totalSavings);
}

// Utility functions
function formatCurrency(amount) {
    return `€${amount.toFixed(2)}`;
}

function parseCurrency(value) {
    return parseFloat(value.replace('€', '')) || 0;
}

// Save functionality
function saveSavings() {
    const savingsData = {
        oneOff: [],
        recurring: []
    };
    
    // Gather one-off savings data
    document.querySelectorAll('#oneOffTable tbody tr').forEach(row => {
        savingsData.oneOff.push({
            category: row.querySelector('td:first-child').textContent,
            amount: row.querySelector('.amount').value,
            description: row.querySelector('.description').value
        });
    });
    
    // Gather recurring savings data
    document.querySelectorAll('#recurringTable tbody tr').forEach(row => {
        savingsData.recurring.push({
            category: row.querySelector('td:first-child').textContent,
            year1: row.querySelector('.year1').value,
            year2: row.querySelector('.year2').value,
            year3: row.querySelector('.year3').value,
            year4: row.querySelector('.year4').value,
            year5: row.querySelector('.year5').value,
            description: row.querySelector('.description').value
        });
    });
    
    // Save to localStorage
    localStorage.setItem('projectSavings', JSON.stringify(savingsData));
    
    // Show save confirmation
    const saveIndicator = document.getElementById('saveIndicator');
    if (saveIndicator) {
        saveIndicator.style.display = 'block';
        setTimeout(() => {
            saveIndicator.style.display = 'none';
        }, 3000);
    }
}

// Load saved data
function loadSavedSavings() {
    const saved = localStorage.getItem('projectSavings');
    if (saved) {
        const data = JSON.parse(saved);
        
        // Load one-off savings
        data.oneOff.forEach((item, index) => {
            const row = document.querySelectorAll('#oneOffTable tbody tr')[index];
            if (row) {
                row.querySelector('.amount').value = item.amount;
                row.querySelector('.description').value = item.description;
            }
        });
        
        // Load recurring savings
        data.recurring.forEach((item, index) => {
            const row = document.querySelectorAll('#recurringTable tbody tr')[index];
            if (row) {
                row.querySelector('.year1').value = item.year1;
                row.querySelector('.year2').value = item.year2;
                row.querySelector('.year3').value = item.year3;
                row.querySelector('.year4').value = item.year4;
                row.querySelector('.year5').value = item.year5;
                row.querySelector('.description').value = item.description;
            }
        });
        
        // Recalculate totals
        calculateOneOffSavings();
        calculateRecurringSavings();
    }
}

function calculateTeamCosts() {
    let total = 0;
    let phaseTotals = {
        validation: 0,
        preparation: 0,
        execution: 0
    };

    document.querySelectorAll('#teamCostsTable tbody tr').forEach(row => {
        const persons = parseFloat(row.querySelector('.persons').value) || 0;
        const rate = parseFloat(row.querySelector('.rate').value) || 0;
        const validationDays = parseFloat(row.querySelector('.days-validation').value) || 0;
        const preparationDays = parseFloat(row.querySelector('.days-preparation').value) || 0;
        const executionDays = parseFloat(row.querySelector('.days-execution').value) || 0;
        const contingency = parseFloat(row.querySelector('.contingency').value) || 0;
        
        const contingencyMultiplier = 1 + (contingency/100);
        
        // Calculate costs for each phase including number of persons and contingency
        const validationCost = rate * validationDays * persons * contingencyMultiplier;
        const preparationCost = rate * preparationDays * persons * contingencyMultiplier;
        const executionCost = rate * executionDays * persons * contingencyMultiplier;
        
        // Add to phase totals
        phaseTotals.validation += validationCost;
        phaseTotals.preparation += preparationCost;
        phaseTotals.execution += executionCost;
        
        // Calculate row total
        const rowTotal = validationCost + preparationCost + executionCost;
        total += rowTotal;
        
        // Update row total display
        const totalCell = row.querySelector('.total');
        if (totalCell) {
            totalCell.textContent = formatCurrency(rowTotal);
        }
    });

    // Update phase cost displays
    document.getElementById('validationPhaseCost').textContent = formatCurrency(phaseTotals.validation);
    document.getElementById('preparationPhaseCost').textContent = formatCurrency(phaseTotals.preparation);
    document.getElementById('executionPhaseCost').textContent = formatCurrency(phaseTotals.execution);
    
    // Update total team costs display
    const totalTeamCostsElement = document.getElementById('totalTeamCosts');
    if (totalTeamCostsElement) {
        totalTeamCostsElement.textContent = formatCurrency(total);
    }

    return {
        total: total,
        phases: phaseTotals
    };
}

// Add initialization for team cost inputs
function initializeEventListeners() {
    // Add input event listeners to all team cost fields
    document.querySelectorAll('#teamCostsTable input').forEach(input => {
        input.addEventListener('input', calculateTotals);
    });
    
    // Add CAPEX checkbox listener
    const capexCheckbox = document.getElementById('isCapexProject');
    if (capexCheckbox) {
        capexCheckbox.addEventListener('change', calculateTotals);
    }
    
    // Add risk score listener
    const riskScore = document.getElementById('riskScore');
    if (riskScore) {
        riskScore.addEventListener('change', calculateTotals);
    }
}