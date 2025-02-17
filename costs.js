// costs.js
document.addEventListener('DOMContentLoaded', function() {
    // Debug log
    console.log('DOM loaded, initializing...');
    
    // First set default values
    setDefaultValues();

    // Then load project information from assessment
    loadProjectInfo();

    // Then add event listeners for inputs
    addInputListeners();

    // Initialize charts before loading saved data
    initializeCharts();

    // Load saved costs if available
    loadSavedCosts();

    // Make sure buttons have proper event listeners
    const saveButton = document.getElementById('saveCosts');
    const resetButton = document.getElementById('resetCosts');
    const nextButton = document.getElementById('nextButton');

    if (saveButton) {
        saveButton.addEventListener('click', saveCosts);
    } else {
        console.error('Save button not found');
    }

    if (resetButton) {
        resetButton.addEventListener('click', resetCosts);
    } else {
        console.error('Reset button not found');
    }

    // Enable next button if costs are saved
    if (nextButton) {
        nextButton.disabled = !localStorage.getItem('projectCosts');
        nextButton.onclick = () => window.location.href = 'value.html';
    }

    // Setup CAPEX handling
    const capexCheckbox = document.getElementById('isCapexProject');
    if (capexCheckbox) {
        capexCheckbox.addEventListener('change', function () {
            updateCapexCalculations();
            // Also trigger the calculation whenever costs change
            calculateTeamCosts();
        });

        // Make sure CAPEX calculations are updated whenever costs change
        const recalculateAll = () => {
            calculateTeamCosts();
            if (capexCheckbox.checked) {
                calculateCapexSplit();
            }
        };

        // Add listeners to all inputs that affect costs
        document.querySelectorAll('input[type="number"]').forEach(input => {
            input.addEventListener('input', recalculateAll);
        });
    }

    // Initial calculations
    calculateTeamCosts();
    calculateTechnologyCosts();
    calculateExternalCosts();
    
    // Initial CAPEX update if needed
    if (capexCheckbox && capexCheckbox.checked) {
        updateCapexCalculations();
    }

    // Update charts one final time
    updateCharts();
});




function loadProjectInfo() {
    const assessment = JSON.parse(localStorage.getItem('projectAssessment') || '{}');

    // Check if we have assessment data
    if (Object.keys(assessment).length === 0) {
        // If no assessment data, show message and disable cost inputs
        showNoAssessmentMessage();
        return;
    }

    // Update summary section with explicit null checks
    document.getElementById('summaryProjectName').textContent =
        assessment.projectName || 'No project name';
    document.getElementById('summaryProjectOwner').textContent =
        assessment.projectOwner || 'No owner specified';
    document.getElementById('summaryDepartment').textContent =
        assessment.department || 'No department specified';
        
    document.getElementById('summaryEstimatedBy').textContent =
        assessment.estimatedBy || 'Not specified';
    document.getElementById('summaryRiskAdjustment').textContent =
        assessment.riskAdjustment || '0%';
}

function showNoAssessmentMessage() {
    const summarySection = document.querySelector('.project-summary');
    summarySection.innerHTML = `
        <div class="alert alert-warning">
            <h2>No Assessment Data Found</h2>
            <p>Please complete the project assessment first before proceeding with cost estimation.</p>
            <a href="assessment.html" class="btn-primary">Go to Assessment</a>
        </div>
    `;

    // Disable all input fields
    document.querySelectorAll('input').forEach(input => {
        input.disabled = true;
    });
}

function addInputListeners() {
    console.log('Adding input listeners');

    // Team costs listeners
    document.querySelectorAll('#teamCostsTable input').forEach(input => {
        input.addEventListener('input', () => {
            console.log('Team cost input changed:', input.className);
            calculateTeamCosts();
        });
    });

    // Technology costs listeners
    document.querySelectorAll('#techCostsTable input').forEach(input => {
        input.addEventListener('input', () => {
            console.log('Tech cost input changed');
            calculateTechnologyCosts();
        });
    });

    // External costs listeners
    document.querySelectorAll('#externalCostsTable input').forEach(input => {
        input.addEventListener('input', () => {
            console.log('External cost input changed');
            calculateExternalCosts();
        });
    });
}
function calculateTeamCosts() {
    let validationTotal = 0;
    let scopingTotal = 0;
    let executionTotal = 0;
    let totalTeamCosts = 0;

    // Log how many rows we're finding
    const rows = document.querySelectorAll('#teamCostsTable tbody tr');
    console.log('Number of rows found:', rows.length);

    rows.forEach((row, index) => {
        // Log which row we're processing
        console.log(`Processing row ${index + 1}`);

        // Get values and ensure they're numbers
        const persons = Number(row.querySelector('.persons').value) || 0;
        const rate = Number(row.querySelector('.rate').value) || 800;
        const validationDays = Number(row.querySelector('.days-validation').value) || 0;
        const scopingDays = Number(row.querySelector('.days-scoping').value) || 0;
        const executionDays = Number(row.querySelector('.days-execution').value) || 0;
        const contingency = row.querySelector('.contingency').value === '' ? 10 : Number(row.querySelector('.contingency').value);

        console.log('Row values:', {
            persons,
            rate,
            validationDays,
            scopingDays,
            executionDays,
            contingency
        });

        const contingencyMultiplier = 1 + (contingency / 100);
        const validationCost = rate * validationDays * persons * contingencyMultiplier;
        const scopingCost = rate * scopingDays * persons * contingencyMultiplier;
        const executionCost = rate * executionDays * persons * contingencyMultiplier;
        const rowTotal = validationCost + scopingCost + executionCost;

        console.log('Row calculations:', {
            contingencyMultiplier,
            validationCost,
            scopingCost,
            executionCost,
            rowTotal
        });

        validationTotal += validationCost;
        scopingTotal += scopingCost;
        executionTotal += executionCost;
        totalTeamCosts += rowTotal;

        // Update row total
        row.querySelector('.total').textContent = formatCurrency(rowTotal);
    });

    console.log('Final totals before updates:', {
        validationTotal,
        scopingTotal,
        executionTotal,
        totalTeamCosts
    });

    // Update phase totals
    document.getElementById('validationPhaseCost').textContent = formatCurrency(validationTotal);
    document.getElementById('scopingPhaseCost').textContent = formatCurrency(scopingTotal);
    document.getElementById('executionPhaseCost').textContent = formatCurrency(executionTotal);

    // Update total team costs
    const totalTeamCostsElement = document.getElementById('totalTeamCosts');
    console.log('Total team costs element found:', !!totalTeamCostsElement);
    if (totalTeamCostsElement) {
        totalTeamCostsElement.textContent = formatCurrency(totalTeamCosts);
        console.log('Updated total team costs to:', formatCurrency(totalTeamCosts));
    }

    // Update summary
    const summaryTeamCostsElement = document.getElementById('summaryTeamCosts');
    console.log('Summary team costs element found:', !!summaryTeamCostsElement);
    if (summaryTeamCostsElement) {
        summaryTeamCostsElement.textContent = formatCurrency(totalTeamCosts);
        console.log('Updated summary team costs to:', formatCurrency(totalTeamCosts));
    }

    updateTotalCosts();
    updateCharts();
}

function calculateTechnologyCosts() {
    let total = 0;

    document.querySelectorAll('#techCostsTable tbody tr').forEach(row => {
        const oneTime = parseFloat(row.querySelector('.tech-onetime').value) || 0;
        const monthly = parseFloat(row.querySelector('.tech-monthly').value) || 0;
        const duration = parseFloat(row.querySelector('.tech-duration').value) || 0;

        const rowTotal = oneTime + (monthly * duration);
        total += rowTotal;

        row.querySelector('.total').textContent = formatCurrency(rowTotal);
    });

    document.getElementById('totalTechCosts').textContent = formatCurrency(total);
    updateTotalCosts();
    updateCharts();
}

function calculateExternalCosts() {
    let total = 0;

    document.querySelectorAll('#externalCostsTable tbody tr').forEach(row => {
        const oneTime = parseFloat(row.querySelector('.external-cost').value) || 0;
        const monthly = parseFloat(row.querySelector('.external-monthly').value) || 0;
        const duration = parseFloat(row.querySelector('.external-duration').value) || 0;
        const contingency = parseFloat(row.querySelector('.external-contingency').value) || 0;

        const monthlyTotal = monthly * duration;
        const subtotal = oneTime + monthlyTotal;
        const rowTotal = subtotal * (1 + contingency / 100);
        
        total += rowTotal;

        row.querySelector('.total').textContent = formatCurrency(rowTotal);
    });

    document.getElementById('totalExternalCosts').textContent = formatCurrency(total);
    updateTotalCosts();
    updateCharts();
}

function updateTotalCosts() {
    // Get the direct number values instead of trying to parse the formatted currency
    const teamCosts = parseCurrency(document.getElementById('totalTeamCosts').textContent);
    const techCosts = parseCurrency(document.getElementById('totalTechCosts').textContent);
    const externalCosts = parseCurrency(document.getElementById('totalExternalCosts').textContent);

    console.log('UpdateTotalCosts values:', { teamCosts, techCosts, externalCosts });

    const subtotal = teamCosts + techCosts + externalCosts;

    // Get risk adjustment percentage
    const riskText = document.getElementById('summaryRiskAdjustment').textContent;
    const riskPercentage = parseFloat(riskText) || 0;

    // Calculate risk adjusted amount
    const riskAmount = subtotal * (riskPercentage / 100);
    const total = subtotal + riskAmount;

    console.log('Final calculations:', { subtotal, riskPercentage, riskAmount, total });

    // Update summary
    document.getElementById('summaryTeamCosts').textContent = formatCurrency(teamCosts);
    document.getElementById('summaryTechCosts').textContent = formatCurrency(techCosts);
    document.getElementById('summaryExternalCosts').textContent = formatCurrency(externalCosts);
    document.getElementById('summaryRiskAmount').textContent = formatCurrency(riskAmount);
    document.getElementById('totalCost').textContent = formatCurrency(total);

    // If CAPEX checkbox is checked, update the split
    const isCapexChecked = document.getElementById('isCapexProject').checked;
    if (isCapexChecked) {
        calculateCapexOpexSplit(teamCosts, techCosts, externalCosts, riskAmount);
    }
    updateCharts();
    calculateProjectCostAndTCO();
}

function saveCosts() {
    const costs = {
        isCapex: document.getElementById('isCapexProject').checked,
        teamCosts: collectTeamCosts(),
        techCosts: collectTechCosts(),
        externalCosts: collectExternalCosts(),
        summary: collectSummary()
    };

    localStorage.setItem('projectCosts', JSON.stringify(costs));

    // Show save confirmation and enable next button
    const saveButton = document.getElementById('saveCosts');
    const nextButton = document.getElementById('nextButton');
    
    saveButton.textContent = 'Saved!';
    saveButton.disabled = true;
    nextButton.disabled = false;
    
    setTimeout(() => {
        saveButton.textContent = 'Save Costs';
        saveButton.disabled = false;
    }, 2000);

    // Add click handler for next button
    nextButton.onclick = () => window.location.href = 'value.html';
}

function loadSavedCosts() {
    const saved = localStorage.getItem('projectCosts');
    if (saved) {
        const costs = JSON.parse(saved);

        // Restore team costs
        if (costs.teamCosts) {
            document.querySelectorAll('#teamCostsTable tbody tr').forEach((row, index) => {
                if (costs.teamCosts[index]) {
                    const data = costs.teamCosts[index];
                    const personsInput = row.querySelector('.persons');
                    const rateInput = row.querySelector('.rate');
                    const validationInput = row.querySelector('.days-validation');
                    const scopingInput = row.querySelector('.days-scoping');
                    const executionInput = row.querySelector('.days-execution');
                    const contingencyInput = row.querySelector('.contingency');

                    if (personsInput) personsInput.value = data.persons || '';
                    if (rateInput) rateInput.value = data.rate || '800';
                    if (validationInput) validationInput.value = data.validationDays || '';
                    if (scopingInput) scopingInput.value = data.scopingDays || '';
                    if (executionInput) executionInput.value = data.executionDays || '';
                    if (contingencyInput) contingencyInput.value = data.contingency || '10';
                }
            });
        }

        // Restore tech costs
        if (costs.techCosts) {
            document.querySelectorAll('#techCostsTable tbody tr').forEach((row, index) => {
                if (costs.techCosts[index]) {
                    const data = costs.techCosts[index];
                    const onetimeInput = row.querySelector('.tech-onetime');
                    const monthlyInput = row.querySelector('.tech-monthly');
                    const durationInput = row.querySelector('.tech-duration');
                    const descInput = row.querySelector('.description');

                    if (onetimeInput) onetimeInput.value = data['tech-onetime'] || '';
                    if (monthlyInput) monthlyInput.value = data['tech-monthly'] || '';
                    if (durationInput) durationInput.value = data['tech-duration'] || '';
                    if (descInput) descInput.value = data.description || '';
                }
            });
        }

        if (costs.externalCosts) {
            document.querySelectorAll('#externalCostsTable tbody tr').forEach((row, index) => {
                if (costs.externalCosts[index]) {
                    const data = costs.externalCosts[index];
                    const costInput = row.querySelector('.external-cost');
                    const monthlyInput = row.querySelector('.external-monthly');
                    const durationInput = row.querySelector('.external-duration');
                    const contingencyInput = row.querySelector('.external-contingency');
                    const descInput = row.querySelector('.description');

                    if (costInput) costInput.value = data['external-cost'] || '';
                    if (monthlyInput) monthlyInput.value = data['external-monthly'] || '';
                    if (durationInput) durationInput.value = data['external-duration'] || '';
                    if (contingencyInput) contingencyInput.value = data['external-contingency'] || '';
                    if (descInput) descInput.value = data.description || '';
                }
            });
        }

        // Restore CAPEX setting if it exists
        const capexCheckbox = document.getElementById('isCapexProject');
        if (capexCheckbox && costs.isCapex !== undefined) {
            capexCheckbox.checked = costs.isCapex;
        }

        // Recalculate everything
        calculateTeamCosts();
        calculateTechnologyCosts();
        calculateExternalCosts();
        updateCapexCalculations();
    }
}

function resetCosts() {
    if (confirm('Are you sure you want to reset all costs? This action cannot be undone.')) {
        // Clear all inputs except rate and contingency
        document.querySelectorAll('input[type="number"]').forEach(input => {
            if (!input.classList.contains('rate') && !input.classList.contains('contingency')) {
                input.value = '';
            }
        });

        // Clear descriptions
        document.querySelectorAll('input[type="text"]').forEach(input => {
            input.value = '';
        });

        // Reset CAPEX checkbox
        const capexCheckbox = document.getElementById('isCapexProject');
        if (capexCheckbox) {
            capexCheckbox.checked = false;
        }

        // Reset to default values
        setDefaultValues();

        // Recalculate all costs
        calculateTeamCosts();
        calculateTechnologyCosts();
        calculateExternalCosts();

        // Clear local storage
        localStorage.removeItem('projectCosts');

        // Disable next button
        const nextButton = document.getElementById('nextButton');
        if (nextButton) {
            nextButton.disabled = true;
        }

        // Update CAPEX/OPEX display
        updateCapexCalculations();
        
        // Update charts
        updateCharts();
    }
}

function parseCurrency(value) {
    if (!value) return 0;
    // Remove currency symbol, thousands separators, and get just the number
    const number = value.replace(/[^0-9.-]+/g, '');
    return parseFloat(number) || 0;
}

function collectTeamCosts() {
    return Array.from(document.querySelectorAll('#teamCostsTable tbody tr')).map(row => ({
        persons: row.querySelector('.persons').value,
        rate: row.querySelector('.rate').value,
        validationDays: row.querySelector('.days-validation').value,
        scopingDays: row.querySelector('.days-scoping').value,  // Updated property name
        executionDays: row.querySelector('.days-execution').value,
        contingency: row.querySelector('.contingency').value
    }));
}

function collectTechCosts() {
    return Array.from(document.querySelectorAll('#techCostsTable tbody tr')).map(row => ({
        'tech-onetime': row.querySelector('.tech-onetime')?.value || '',
        'tech-monthly': row.querySelector('.tech-monthly')?.value || '',
        'tech-duration': row.querySelector('.tech-duration')?.value || '',
        description: row.querySelector('.description')?.value || ''
    }));
}

function collectExternalCosts() {
    return Array.from(document.querySelectorAll('#externalCostsTable tbody tr')).map(row => ({
        'external-cost': row.querySelector('.external-cost')?.value || '',
        'external-monthly': row.querySelector('.external-monthly')?.value || '',
        'external-duration': row.querySelector('.external-duration')?.value || '',
        'external-contingency': row.querySelector('.external-contingency')?.value || '',
        description: row.querySelector('.description')?.value || ''
    }));
}

function collectSummary() {
    return {
        totalProjectCost: parseCurrency(document.getElementById('totalProjectCost').textContent),
        totalMaintenanceCost: parseCurrency(document.getElementById('totalTCO').textContent),
        teamCosts: parseCurrency(document.getElementById('summaryTeamCosts').textContent),
        techCosts: parseCurrency(document.getElementById('summaryTechCosts').textContent),
        externalCosts: parseCurrency(document.getElementById('summaryExternalCosts').textContent),
        riskAmount: parseCurrency(document.getElementById('summaryRiskAmount').textContent)
    };
}
function restoreTeamCosts(teamCosts) {
    // Restoration logic for team costs
    // ... Implementation details
}

function restoreTechCosts(techCosts) {
    // Restoration logic for technology costs
    // ... Implementation details
}

function restoreExternalCosts(externalCosts) {
    // Restoration logic for external costs
    // ... Implementation details
}
function setDefaultValues() {
    // Set default values for all team members
    document.querySelectorAll('#teamCostsTable tbody tr').forEach(row => {
        // Set daily rate to 800
        const rateInput = row.querySelector('.rate');
        rateInput.value = '800';

        // Set contingency to 10
        const contingencyInput = row.querySelector('.contingency');
        contingencyInput.value = '10';
    });

    // Log for debugging
    console.log('Default values set');
}

// Helper function for currency formatting
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-EU', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount)
        .replace('EUR', '�'); // Explicitly replace EUR with � symbol
}

// Helper function for parsing currency
function parseCurrency(value) {
    if (typeof value !== 'string') return 0;
    return Number(value.replace(/[^0-9.-]+/g, '')) || 0;
}

function updateCapexCalculations() {
    const isCapex = document.getElementById('isCapexProject').checked;
    const costClassification = document.querySelector('.cost-classification');

    console.log('CAPEX checkbox changed:', isCapex);  // Debug log

    if (isCapex) {
        calculateCapexSplit();
        if (costClassification) {
            costClassification.style.display = 'block';
        }
    } else {
        if (costClassification) {
            costClassification.style.display = 'none';
        }
        document.getElementById('capexTotal').textContent = formatCurrency(0);
        document.getElementById('opexTotal').textContent = formatCurrency(0);
    }
}

function calculateCapexSplit() {
    console.log('Calculating CAPEX split...');  // Debug log

    // Get all base costs
    const teamCosts = parseCurrency(document.getElementById('totalTeamCosts').textContent);
    const techCosts = parseCurrency(document.getElementById('totalTechCosts').textContent);
    const externalCosts = parseCurrency(document.getElementById('totalExternalCosts').textContent);
    const riskAmount = parseCurrency(document.getElementById('summaryRiskAmount').textContent);

    console.log('Base costs:', { teamCosts, techCosts, externalCosts, riskAmount });  // Debug log

    // Get phase costs
    const validationCost = parseCurrency(document.getElementById('validationPhaseCost').textContent);
    const scopingCost = parseCurrency(document.getElementById('scopingPhaseCost').textContent);
    const executionCost = parseCurrency(document.getElementById('executionPhaseCost').textContent);

    console.log('Phase costs:', { validationCost, scopingCost, executionCost });  // Debug log

    // Get technology costs split
    const oneTimeTechCosts = calculateOneTimeTechCosts();
    const recurringTechCosts = techCosts - oneTimeTechCosts;

    console.log('Tech costs split:', { oneTimeTechCosts, recurringTechCosts });  // Debug log

    // Calculate CAPEX amounts
    const capexTeamCosts = scopingCost + executionCost;
    const capexTechCosts = oneTimeTechCosts;
    const capexExternalCosts = externalCosts;

    // Calculate OPEX amounts
    const opexTeamCosts = validationCost;
    const opexTechCosts = recurringTechCosts;

    // Calculate base totals before risk
    const baseCapex = capexTeamCosts + capexTechCosts + capexExternalCosts;
    const baseOpex = opexTeamCosts + opexTechCosts;
    const totalBeforeRisk = baseCapex + baseOpex;

    console.log('Base totals:', { baseCapex, baseOpex, totalBeforeRisk });  // Debug log

    // Distribute risk adjustment
    let capexRisk = 0;
    let opexRisk = 0;

    if (totalBeforeRisk > 0) {
        const capexRatio = baseCapex / totalBeforeRisk;
        const opexRatio = baseOpex / totalBeforeRisk;

        capexRisk = riskAmount * capexRatio;
        opexRisk = riskAmount * opexRatio;
    }

    console.log('Risk distribution:', { capexRisk, opexRisk });  // Debug log

    // Calculate final totals
    const totalCapex = baseCapex + capexRisk;
    const totalOpex = baseOpex + opexRisk;

    console.log('Final totals:', { totalCapex, totalOpex });  // Debug log

    // Update display
    document.getElementById('capexTotal').textContent = formatCurrency(totalCapex);
    document.getElementById('opexTotal').textContent = formatCurrency(totalOpex);

    // Make the classification section visible
    const costClassification = document.querySelector('.cost-classification');
    if (costClassification) {
        costClassification.style.display = 'block';
    }
}
function calculateCapexOpexSplit(teamCosts, techCosts, externalCosts, riskAmount) {
    console.log('Starting CAPEX/OPEX calculation with:', {
        teamCosts, techCosts, externalCosts, riskAmount
    });

    // Get validation phase cost (OPEX)
    const validationCost = parseCurrency(document.getElementById('validationPhaseCost').textContent);

    // Get scoping and execution costs (CAPEX)
    const scopingCost = parseCurrency(document.getElementById('scopingPhaseCost').textContent);
    const executionCost = parseCurrency(document.getElementById('executionPhaseCost').textContent);

    // Get one-time tech costs (CAPEX) vs recurring (OPEX)
    const oneTimeTechCosts = calculateOneTimeTechCosts();
    const recurringTechCosts = techCosts - oneTimeTechCosts;

    // Calculate base CAPEX and OPEX
    const baseCapex = scopingCost + executionCost + oneTimeTechCosts + externalCosts;
    const baseOpex = validationCost + recurringTechCosts;

    // Distribute risk amount proportionally
    const totalBeforeRisk = baseCapex + baseOpex;
    let capexRisk = 0;
    let opexRisk = 0;

    if (totalBeforeRisk > 0) {
        capexRisk = (baseCapex / totalBeforeRisk) * riskAmount;
        opexRisk = (baseOpex / totalBeforeRisk) * riskAmount;
    }

    // Calculate final CAPEX and OPEX
    const totalCapex = baseCapex + capexRisk;
    const totalOpex = baseOpex + opexRisk;

    console.log('CAPEX/OPEX calculations:', {
        validationCost,
        scopingCost,
        executionCost,
        oneTimeTechCosts,
        recurringTechCosts,
        baseCapex,
        baseOpex,
        capexRisk,
        opexRisk,
        totalCapex,
        totalOpex
    });

    // Update display with explicit number conversion and fallback to 0
    document.getElementById('capexTotal').textContent = formatCurrency(Number(totalCapex) || 0);
    document.getElementById('opexTotal').textContent = formatCurrency(Number(totalOpex) || 0);
}

function calculateOneTimeTechCosts() {
    let total = 0;
    document.querySelectorAll('#techCostsTable tbody tr').forEach(row => {
        const oneTime = parseFloat(row.querySelector('.tech-onetime').value) || 0;
        total += oneTime;
    });
    return total;
}

let costDistributionChart;
let phaseDistributionChart;

function initializeCharts() {
    console.log('Initializing charts...');
    const costDistCanvas = document.getElementById('costDistributionChart');
    const costTimeCanvas = document.getElementById('costOverTimeChart');

    if (!costDistCanvas || !costTimeCanvas) {
        console.error('Chart canvases not found');
        return;
    }

    // Initialize Cost Distribution Chart
    costDistributionChart = new Chart(costDistCanvas, {
        type: 'pie',
        data: {
            labels: ['Team Costs', 'Technology Costs', 'External Costs', 'Risk Adjustment'],
            datasets: [{
                data: [0, 0, 0, 0],
                backgroundColor: [
                    '#F06D0D',  // Original orange
                    '#4A90E2',  // Blue
                    '#50C878',  // Green
                    '#FFB563'   // Light orange
                ],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 1.5,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: { size: 14 },
                        padding: 20,
                        color: '#333333'
                    }
                }
            }
        }
    });

    // Initialize Cost Over Time Chart
    phaseDistributionChart = new Chart(costTimeCanvas, {
        type: 'bar',
        data: {
            labels: ['Project Phases', 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'],
            datasets: [{
                label: 'Total Cost',
                data: [0, 0, 0, 0, 0, 0],
                backgroundColor: '#F06D0D'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 1.5,
            scales: {
                x: {
                    stacked: true,
                    grid: { display: false }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: {
                        callback: value => formatCurrency(value)
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: { size: 12 },
                        padding: 20
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatCurrency(context.raw)}`;
                        }
                    }
                }
            }
        }
    });

    updateCharts();
}

function updateCharts() {
    if (!costDistributionChart || !phaseDistributionChart) {
        console.warn('Charts not initialized');
        return;
    }

    try {
        // Update Cost Distribution Chart
        const teamCosts = parseCurrency(document.getElementById('summaryTeamCosts').textContent);
        const techCosts = parseCurrency(document.getElementById('summaryTechCosts').textContent);
        const externalCosts = parseCurrency(document.getElementById('summaryExternalCosts').textContent);
        const riskAmount = parseCurrency(document.getElementById('summaryRiskAmount').textContent);

        costDistributionChart.data.datasets[0].data = [teamCosts, techCosts, externalCosts, riskAmount];
        costDistributionChart.update();

        // Get all costs
        const validationCost = parseCurrency(document.getElementById('validationPhaseCost').textContent);
        const scopingCost = parseCurrency(document.getElementById('scopingPhaseCost').textContent);
        const executionCost = parseCurrency(document.getElementById('executionPhaseCost').textContent);
        const techOnetimeCosts = calculateOneTimeTechCosts();
        const recurringTechCosts = calculateRecurringTechCosts();
        const yearlyTechCosts = (recurringTechCosts / 12) * 12; // Monthly to yearly

        // Check CAPEX status
        const isCapexProject = document.getElementById('isCapexProject').checked;

        if (isCapexProject) {
            phaseDistributionChart.data.datasets = [
                {
                    label: 'CAPEX',
                    data: [
                        scopingCost + executionCost + techOnetimeCosts + externalCosts,
                        0, 0, 0, 0, 0
                    ],
                    backgroundColor: '#F06D0D',
                    stack: 'stack0'
                },
                {
                    label: 'OPEX',
                    data: [
                        validationCost,
                        yearlyTechCosts,
                        yearlyTechCosts,
                        yearlyTechCosts,
                        yearlyTechCosts,
                        yearlyTechCosts
                    ],
                    backgroundColor: '#4A90E2',
                    stack: 'stack0'
                }
            ];
        } else {
            phaseDistributionChart.data.datasets = [{
                label: 'Total Cost',
                data: [
                    validationCost + scopingCost + executionCost + techOnetimeCosts + externalCosts,
                    yearlyTechCosts,
                    yearlyTechCosts,
                    yearlyTechCosts,
                    yearlyTechCosts,
                    yearlyTechCosts
                ],
                backgroundColor: '#F06D0D'
            }];
        }

        phaseDistributionChart.update();

    } catch (error) {
        console.error('Error updating charts:', error);
    }
}

// Helper function to calculate recurring tech costs
function calculateRecurringTechCosts() {
    let total = 0;
    document.querySelectorAll('#techCostsTable tbody tr').forEach(row => {
        const monthly = parseFloat(row.querySelector('.tech-monthly').value) || 0;
        const duration = parseFloat(row.querySelector('.tech-duration').value) || 0;
        total += monthly * duration;
    });
    return total;
}

// Update the initializeCharts function for the phase distribution chart
function initializeCharts() {
    console.log('Initializing charts...');
    const costDistCanvas = document.getElementById('costDistributionChart');
    const costTimeCanvas = document.getElementById('costOverTimeChart');

    if (!costDistCanvas || !costTimeCanvas) {
        console.error('Chart canvases not found', {
            costDist: costDistCanvas,
            costTime: costTimeCanvas
        });
        return;
    }

    // Initialize Cost Distribution Chart
    costDistributionChart = new Chart(costDistCanvas, {
        type: 'pie',
        data: {
            labels: ['Team Costs', 'Technology Costs', 'External Costs', 'Risk Adjustment'],
            datasets: [{
                data: [0, 0, 0, 0],
                backgroundColor: [
                    '#F06D0D',  // Original orange
                    '#4A90E2',  // Blue
                    '#50C878',  // Green
                    '#FFB563'   // Light orange
                ],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 1.5,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: {
                            size: 14
                        },
                        padding: 20,
                        color: '#333333'
                    }
                }
            }
        }
    });

    // Initialize Cost Over Time Chart
    phaseDistributionChart = new Chart(costTimeCanvas, {
        type: 'bar',
        data: {
            labels: ['Project Phases', 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'],
            datasets: [
                {
                    label: 'CAPEX',
                    data: [0, 0, 0, 0, 0, 0],
                    backgroundColor: '#F06D0D',
                    stack: 'stack0'
                },
                {
                    label: 'OPEX',
                    data: [0, 0, 0, 0, 0, 0],
                    backgroundColor: '#4A90E2',
                    stack: 'stack0'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 1.5,
            scales: {
                x: {
                    stacked: true,
                    grid: {
                        display: false
                    }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: {
                        callback: value => formatCurrency(value)
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: { size: 12 },
                        padding: 20
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatCurrency(context.raw)}`;
                        }
                    }
                }
            }
        }
    });

    console.log('Charts initialized successfully');
    updateCharts();
}


function calculateProjectCostAndTCO() {
    // Get phase costs
    const validationCost = parseCurrency(document.getElementById('validationPhaseCost').textContent);
    const scopingCost = parseCurrency(document.getElementById('scopingPhaseCost').textContent);
    const executionCost = parseCurrency(document.getElementById('executionPhaseCost').textContent);

    // Get one-time and recurring tech costs
    const oneTimeTechCosts = calculateOneTimeTechCosts();
    const recurringTechCosts = parseCurrency(document.getElementById('totalTechCosts').textContent) - oneTimeTechCosts;

    // Get external costs
    const externalCosts = parseCurrency(document.getElementById('totalExternalCosts').textContent);

    // Get risk adjustment
    const riskText = document.getElementById('summaryRiskAdjustment').textContent;
    const riskPercentage = parseFloat(riskText) || 0;

    // Calculate Project Cost (similar to CAPEX)
    const baseProjectCost = scopingCost + executionCost + oneTimeTechCosts + externalCosts;
    const projectRiskAmount = baseProjectCost * (riskPercentage / 100);
    const totalProjectCost = baseProjectCost + projectRiskAmount;

    // Calculate TCO (validation + recurring costs)
    const baseTCO = validationCost + recurringTechCosts;
    const tcoRiskAmount = baseTCO * (riskPercentage / 100);
    const totalTCO = baseTCO + tcoRiskAmount;

    // Update display
    document.getElementById('totalProjectCost').textContent = formatCurrency(totalProjectCost);
    document.getElementById('totalTCO').textContent = formatCurrency(totalTCO);

    // Store these values in localStorage so business case can access them
    const costs = JSON.parse(localStorage.getItem('projectCosts') || '{}');
    costs.totalProjectCost = totalProjectCost;
    costs.totalTCO = totalTCO;
    localStorage.setItem('projectCosts', JSON.stringify(costs));
}