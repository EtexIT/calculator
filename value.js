// value.js
document.addEventListener('DOMContentLoaded', function() {
    // Load project information from assessment
    loadProjectInfo();
    
    // Initialize charts first before doing any other operations
    initializeCharts();
    
    // Add input event listeners
    addInputListeners();
    
    // Load saved values if available
    loadSavedValues();

    // Add button event listeners
    document.getElementById('saveValue').addEventListener('click', saveValues);
    document.getElementById('resetValue').addEventListener('click', resetValues);

    // Update charts again after loading values to make sure they reflect the data
    updateCharts();

    const nextButton = document.getElementById('nextButton');
    if (nextButton) {
        nextButton.disabled = !localStorage.getItem('projectValue');
        nextButton.onclick = () => window.location.href = 'business-case.html';
    }
});

function loadProjectInfo() {
    const assessment = JSON.parse(localStorage.getItem('projectAssessment') || '{}');

    // Check if we have assessment data
    if (Object.keys(assessment).length === 0) {
        showNoAssessmentMessage();
        return;
    }

    document.getElementById('summaryProjectName').textContent = assessment.projectName || 'No project name';
    document.getElementById('summaryProjectOwner').textContent = assessment.projectOwner || 'No owner specified';
    document.getElementById('summaryDepartment').textContent = assessment.department || 'No department specified';
    document.getElementById('summaryEstimatedBy').textContent = assessment.estimatedBy || 'Not specified';
}

function addInputListeners() {
    // One-off value listeners
    document.querySelectorAll('#oneOffTable input').forEach(input => {
        input.addEventListener('input', calculateOneOffValues);
    });

    // Recurring value listeners
    document.querySelectorAll('#recurringTable input').forEach(input => {
        input.addEventListener('input', calculateRecurringValues);
    });
}

function calculateOneOffValues() {
    let total = 0;
    
    document.querySelectorAll('#oneOffTable tbody tr').forEach(row => {
        const amount = parseFloat(row.querySelector('.amount').value) || 0;
        total += amount;
        row.querySelector('.total').textContent = formatCurrency(amount);
    });

    document.getElementById('totalOneOffValue').textContent = formatCurrency(total);
    document.getElementById('summaryOneOffValue').textContent = formatCurrency(total);
    
    updateTotalProjectValue();
    updateCharts();
}

function calculateRecurringValues() {
    let yearlyTotals = [0, 0, 0, 0, 0]; // Array for 5 years

    document.querySelectorAll('#recurringTable tbody tr').forEach(row => {
        const years = ['year1', 'year2', 'year3', 'year4', 'year5'];
        years.forEach((year, index) => {
            const value = parseFloat(row.querySelector(`.${year}`).value) || 0;
            yearlyTotals[index] += value;
        });
    });

    // Update yearly totals
    yearlyTotals.forEach((total, index) => {
        document.getElementById(`year${index + 1}Total`).textContent = formatCurrency(total);
    });

    // Calculate and update total recurring value
    const totalRecurring = yearlyTotals.reduce((sum, current) => sum + current, 0);
    document.getElementById('summaryRecurringValue').textContent = formatCurrency(totalRecurring);

    updateTotalProjectValue();
    updateCharts();
}

function updateTotalProjectValue() {
    const oneOffTotal = parseCurrency(document.getElementById('summaryOneOffValue').textContent);
    const recurringTotal = parseCurrency(document.getElementById('summaryRecurringValue').textContent);
    const totalValue = oneOffTotal + recurringTotal;
    
    document.getElementById('totalProjectValue').textContent = formatCurrency(totalValue);
}

function saveValues() {
    const valueData = {
        oneOff: collectOneOffValues(),
        recurring: collectRecurringValues(),
        comments: document.getElementById('valueComments').value
    };

    localStorage.setItem('projectValue', JSON.stringify(valueData));

    // Show save confirmation and enable next button
    const saveButton = document.getElementById('saveValue');
    const nextButton = document.getElementById('nextButton');
    
    saveButton.textContent = 'Saved!';
    saveButton.disabled = true;
    nextButton.disabled = false;
    
    setTimeout(() => {
        saveButton.textContent = 'Save Value';
        saveButton.disabled = false;
    }, 2000);

    // Add click handler for next button
    nextButton.onclick = () => window.location.href = 'business-case.html';
}

function collectOneOffValues() {
    return Array.from(document.querySelectorAll('#oneOffTable tbody tr')).map(row => ({
        amount: row.querySelector('.amount').value,
        description: row.querySelector('.description').value
    }));
}

function collectRecurringValues() {
    return Array.from(document.querySelectorAll('#recurringTable tbody tr')).map(row => ({
        year1: row.querySelector('.year1').value,
        year2: row.querySelector('.year2').value,
        year3: row.querySelector('.year3').value,
        year4: row.querySelector('.year4').value,
        year5: row.querySelector('.year5').value,
        description: row.querySelector('.description').value
    }));
}

function loadSavedValues() {
    const saved = localStorage.getItem('projectValue');
    if (saved) {
        const data = JSON.parse(saved);
        
        // Restore one-off values
        data.oneOff.forEach((item, index) => {
            const row = document.querySelectorAll('#oneOffTable tbody tr')[index];
            if (row) {
                row.querySelector('.amount').value = item.amount || '';
                row.querySelector('.description').value = item.description || '';
            }
            if (data.comments) {
                document.getElementById('valueComments').value = data.comments;
            }
        });
        
        // Restore recurring values
        data.recurring.forEach((item, index) => {
            const row = document.querySelectorAll('#recurringTable tbody tr')[index];
            if (row) {
                row.querySelector('.year1').value = item.year1 || '';
                row.querySelector('.year2').value = item.year2 || '';
                row.querySelector('.year3').value = item.year3 || '';
                row.querySelector('.year4').value = item.year4 || '';
                row.querySelector('.year5').value = item.year5 || '';
                row.querySelector('.description').value = item.description || '';
            }
        });

        // Recalculate totals
        calculateOneOffValues();
        calculateRecurringValues();
    }
}

function resetValues() {
    if (confirm('Are you sure you want to reset all values? This action cannot be undone.')) {
        document.querySelectorAll('input').forEach(input => {
            input.value = '';
        });
        
        calculateOneOffValues();
        calculateRecurringValues();
        
        localStorage.removeItem('projectValue');
    }
}

let valueFlowChart;
let accumulatedValueChart;

function initializeCharts() {
    const flowCtx = document.getElementById('valueFlowChart');
    const accumulatedCtx = document.getElementById('accumulatedValueChart');

    if (!flowCtx || !accumulatedCtx) {
        console.warn('Chart canvas elements not found');
        return;
    }

    // Initialize Value Flow Chart
    valueFlowChart = new Chart(flowCtx, {
        type: 'bar',
        data: {
            labels: ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'],
            datasets: [{
                label: 'One-off Value',
                data: [0, 0, 0, 0, 0],
                backgroundColor: '#F06D0D'
            }, {
                label: 'Recurring Value',
                data: [0, 0, 0, 0, 0],
                backgroundColor: '#4A90E2'
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
                        callback: value => '€' + value.toLocaleString()
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });

    // Initialize Accumulated Value Chart
    accumulatedValueChart = new Chart(accumulatedCtx, {
        type: 'line',
        data: {
            labels: ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'],
            datasets: [{
                label: 'Accumulated Value',
                data: [0, 0, 0, 0, 0],
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
                        callback: value => '€' + value.toLocaleString()
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

function updateCharts() {
    if (!valueFlowChart || !accumulatedValueChart) {
        console.warn('Charts not initialized');
        return;
    }

    // Get values for charts
    const oneOffTotal = parseCurrency(document.getElementById('summaryOneOffValue').textContent);
    const yearTotals = Array.from({length: 5}, (_, i) => 
        parseCurrency(document.getElementById(`year${i + 1}Total`).textContent)
    );

    // Update Value Flow Chart
    valueFlowChart.data.datasets[0].data = [oneOffTotal, 0, 0, 0, 0];
    valueFlowChart.data.datasets[1].data = yearTotals;
    valueFlowChart.update();

    // Calculate and update Accumulated Value
    let accumulated = 0;
    const accumulatedData = yearTotals.map((yearly, index) => {
        accumulated += yearly + (index === 0 ? oneOffTotal : 0);
        return accumulated;
    });

    accumulatedValueChart.data.datasets[0].data = accumulatedData;
    accumulatedValueChart.update();
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