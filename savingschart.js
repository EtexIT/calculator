// Global chart variables
let savingsFlowChart;
let accumulatedBenefitChart;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Initialize charts first
    initializeCharts();
    
    // Add input event listeners for one-off savings
    document.querySelectorAll('#oneOffTable input').forEach(input => {
        input.addEventListener('input', handleSavingsUpdate);
    });

    // Add input event listeners for recurring savings
    document.querySelectorAll('#recurringTable input').forEach(input => {
        input.addEventListener('input', handleSavingsUpdate);
    });

    // Initialize calculations
    handleSavingsUpdate();
    
    // Load any saved data
    loadSavedSavings();
});

function handleSavingsUpdate() {
    calculateOneOffSavings();
    calculateRecurringSavings();
    updateCharts();
}

function initializeCharts() {
    // Cash flow chart initialization
    const flowCtx = document.getElementById('cashFlowChart').getContext('2d');
    savingsFlowChart = new Chart(flowCtx, {
        type: 'bar',
        data: {
            labels: ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'],
            datasets: [{
                label: 'One-off Savings',
                data: [0, 0, 0, 0, 0],
                backgroundColor: '#22C55E'
            }, {
                label: 'Recurring Savings',
                data: [0, 0, 0, 0, 0],
                backgroundColor: '#3B82F6'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Yearly Savings Distribution'
                },
                legend: {
                    position: 'bottom'
                }
            },
            scales: {
                x: {
                    stacked: true
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Amount (€)'
                    },
                    ticks: {
                        callback: function(value) {
                            return '€' + value.toLocaleString();
                        }
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
                data: [0, 0, 0, 0, 0],
                borderColor: '#A855F7',
                backgroundColor: 'rgba(168, 85, 247, 0.1)',
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
                    text: 'Accumulated Benefits Over Time'
                },
                legend: {
                    position: 'bottom'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Accumulated Amount (€)'
                    },
                    ticks: {
                        callback: function(value) {
                            return '€' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

function calculateOneOffSavings() {
    let total = 0;
    
    // Calculate total for each row
    document.querySelectorAll('#oneOffTable tbody tr').forEach(row => {
        const amount = parseFloat(row.querySelector('.amount')?.value) || 0;
        total += amount;
        
        // Update row total if there's a total cell
        const totalCell = row.querySelector('.row-total');
        if (totalCell) {
            totalCell.textContent = formatCurrency(amount);
        }
    });
    
    // Update total one-off savings
    const totalOneOffElement = document.getElementById('totalOneOffSavings');
    if (totalOneOffElement) {
        totalOneOffElement.textContent = formatCurrency(total);
    }
    
    // Update summary
    const summaryOneOffElement = document.getElementById('summaryOneOffSavings');
    if (summaryOneOffElement) {
        summaryOneOffElement.textContent = formatCurrency(total);
    }
    
    return total;
}

function calculateRecurringSavings() {
    let yearlyTotals = [0, 0, 0, 0, 0]; // Array for 5 years
    
    // Calculate totals for each row
    document.querySelectorAll('#recurringTable tbody tr').forEach(row => {
        // Get values for each year
        const years = ['year1', 'year2', 'year3', 'year4', 'year5'];
        years.forEach((year, index) => {
            const value = parseFloat(row.querySelector(`.${year}`)?.value) || 0;
            yearlyTotals[index] += value;
        });
    });
    
    // Update yearly totals in the table
    yearlyTotals.forEach((total, index) => {
        const yearTotalElement = document.getElementById(`yearTotal${index + 1}`);
        if (yearTotalElement) {
            yearTotalElement.textContent = formatCurrency(total);
        }
    });
    
    // Calculate and update total recurring savings
    const totalRecurring = yearlyTotals.reduce((sum, current) => sum + current, 0);
    const summaryRecurringElement = document.getElementById('summaryRecurringSavings');
    if (summaryRecurringElement) {
        summaryRecurringElement.textContent = formatCurrency(totalRecurring);
    }
    
    return yearlyTotals;
}

function updateTotalProjectSavings() {
    const oneOffTotal = parseCurrency(document.getElementById('summaryOneOffSavings')?.textContent || '€0.00');
    const recurringTotal = parseCurrency(document.getElementById('summaryRecurringSavings')?.textContent || '€0.00');
    
    const totalSavings = oneOffTotal + recurringTotal;
    const totalProjectElement = document.getElementById('totalProjectSavings');
    if (totalProjectElement) {
        totalProjectElement.textContent = formatCurrency(totalSavings);
    }
}

function updateCharts() {
    // Get one-off savings (all in first year)
    const oneOffTotal = calculateOneOffSavings();
    const oneOffData = [oneOffTotal, 0, 0, 0, 0];
    
    // Get recurring savings per year
    const recurringData = calculateRecurringSavings();
    
    // Update cash flow chart
    if (savingsFlowChart && savingsFlowChart.data) {
        savingsFlowChart.data.datasets[0].data = oneOffData;
        savingsFlowChart.data.datasets[1].data = recurringData;
        savingsFlowChart.update();
    }
    
    // Calculate and update accumulated benefit
    let accumulated = 0;
    const accumulatedData = recurringData.map((recurring, index) => {
        accumulated += recurring + (index === 0 ? oneOffTotal : 0);
        return accumulated;
    });
    
    if (accumulatedBenefitChart && accumulatedBenefitChart.data) {
        accumulatedBenefitChart.data.datasets[0].data = accumulatedData;
        accumulatedBenefitChart.update();
    }
    
    // Update total project savings
    updateTotalProjectSavings();
}

// Utility functions
function formatCurrency(amount) {
    return `€${Number(amount).toFixed(2)}`;
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
            amount: row.querySelector('.amount')?.value || '',
            description: row.querySelector('.description')?.value || ''
        });
    });
    
    // Gather recurring savings data
    document.querySelectorAll('#recurringTable tbody tr').forEach(row => {
        savingsData.recurring.push({
            category: row.querySelector('td:first-child').textContent,
            year1: row.querySelector('.year1')?.value || '',
            year2: row.querySelector('.year2')?.value || '',
            year3: row.querySelector('.year3')?.value || '',
            year4: row.querySelector('.year4')?.value || '',
            year5: row.querySelector('.year5')?.value || '',
            description: row.querySelector('.description')?.value || ''
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
                const amountInput = row.querySelector('.amount');
                const descriptionInput = row.querySelector('.description');
                if (amountInput) amountInput.value = item.amount;
                if (descriptionInput) descriptionInput.value = item.description;
            }
        });
        
        // Load recurring savings
        data.recurring.forEach((item, index) => {
            const row = document.querySelectorAll('#recurringTable tbody tr')[index];
            if (row) {
                const years = ['year1', 'year2', 'year3', 'year4', 'year5'];
                years.forEach(year => {
                    const input = row.querySelector(`.${year}`);
                    if (input) input.value = item[year];
                });
                const descriptionInput = row.querySelector('.description');
                if (descriptionInput) descriptionInput.value = item.description;
            }
        });
        
        // Recalculate everything
        handleSavingsUpdate();
    }
}