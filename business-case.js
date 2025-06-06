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
    document.getElementById('exportJSON').addEventListener('click', exportProjectData);
});

function loadFinancialData() {
    // Load costs and values from localStorage
    const costs = JSON.parse(localStorage.getItem('projectCosts') || '{}');
    const values = JSON.parse(localStorage.getItem('projectValue') || '{}');
    
    console.log('Loaded costs:', costs);
    console.log('Loaded values:', values);
    
    if (Object.keys(costs).length === 0 || Object.keys(values).length === 0) {
        showIncompleteDataMessage();
        return;
    }

    // Get the values from the saved summary
    if (costs.summary) {
        document.getElementById('projectCostValue').textContent = 
            formatCurrency(costs.summary.totalProjectCost || 0);
        document.getElementById('tcoValue').textContent = 
            formatCurrency(costs.summary.totalMaintenanceCost || 0);
    }

    calculateFinancialMetrics(costs, values);
}

function calculateProjectCost(costs) {
    let projectCost = 0;
    const assessment = JSON.parse(localStorage.getItem('projectAssessment') || '{}');
    const riskPercentage = parseFloat(assessment.riskAdjustment.replace('%', '')) / 100 || 0;

    // Calculate team costs for scoping and execution phases
    if (costs.teamCosts) {
        costs.teamCosts.forEach(member => {
            const scopingCost = (parseFloat(member.scopingDays) || 0) * 
                              (parseFloat(member.persons) || 0) * 
                              (parseFloat(member.rate) || 0);
            const executionCost = (parseFloat(member.executionDays) || 0) * 
                                (parseFloat(member.persons) || 0) * 
                                (parseFloat(member.rate) || 0);
            const contingency = (parseFloat(member.contingency) || 0) / 100;
            
            projectCost += (scopingCost + executionCost) * (1 + contingency);
        });
    }

    // Add one-time tech costs
    if (costs.techCosts) {
        costs.techCosts.forEach(tech => {
            projectCost += parseFloat(tech['tech-onetime']) || 0;
        });
    }

    // Add external costs
    if (costs.externalCosts) {
        costs.externalCosts.forEach(external => {
            const oneTimeCost = parseFloat(external['external-cost']) || 0;
            const contingency = (parseFloat(external['external-contingency']) || 0) / 100;
            projectCost += oneTimeCost * (1 + contingency);
        });
    }

    // Apply risk adjustment at the end
    projectCost *= (1 + riskPercentage);

    return projectCost;
}

function calculateTCO(costs) {
    let tco = 0;
    
    // Calculate validation phase team costs
    if (costs.teamCosts) {
        costs.teamCosts.forEach(member => {
            const validationCost = (parseFloat(member.validationDays) || 0) * 
                                 (parseFloat(member.persons) || 0) * 
                                 (parseFloat(member.rate) || 0);
            const contingency = (parseFloat(member.contingency) || 0) / 100;
            
            tco += validationCost * (1 + contingency);
        });
    }

    // Add recurring tech costs
    if (costs.techCosts) {
        costs.techCosts.forEach(tech => {
            const monthly = parseFloat(tech['tech-monthly']) || 0;
            const duration = parseFloat(tech['tech-duration']) || 0;
            tco += monthly * duration;
        });
    }

    // Apply risk adjustment
    const assessment = JSON.parse(localStorage.getItem('projectAssessment') || '{}');
    if (assessment.riskAdjustment) {
        const riskPercentage = parseFloat(assessment.riskAdjustment.replace('%', '')) / 100 || 0;
        tco *= (1 + riskPercentage);
    }

    return tco;
}



function processYearlyData(costs, values) {
    let yearlyData = Array(5).fill(null).map(() => ({
        costs: 0,
        oneOffValue: 0,
        recurringValue: 0,
        netFlow: 0,
        accumulated: 0
    }));

    // Load cost distribution data if available
    const distribution = JSON.parse(localStorage.getItem('costDistribution') || '{}');
    
    if (distribution.projectDistribution && distribution.projectDistribution.values) {
        // Use actual cost distribution data for project costs
        const projectDist = distribution.projectDistribution.values;
        const years = ['2025', '2026', '2027', '2028', '2029'];
        
        years.forEach((year, index) => {
            // Sum all project cost types for this year
            const costTypes = ['project-team', 'project-tech', 'project-external', 'project-risk'];
            costTypes.forEach(type => {
                if (projectDist[type] && projectDist[type][year]) {
                    yearlyData[index].costs += parseFloat(projectDist[type][year]) || 0;
                }
            });
        });
    } else {
        // Fallback to old calculation method if no distribution data
        // Team costs - add to first year
        if (costs.teamCosts) {
            const totalTeamCosts = costs.teamCosts.reduce((sum, member) => {
                const daysTotal = (parseFloat(member.validationDays) || 0) +
                                (parseFloat(member.scopingDays) || 0) +
                                (parseFloat(member.executionDays) || 0);
                const persons = parseFloat(member.persons) || 0;
                const rate = parseFloat(member.rate) || 0;
                const contingency = (parseFloat(member.contingency) || 0) / 100;
                
                return sum + (daysTotal * persons * rate * (1 + contingency));
            }, 0);
            
            yearlyData[0].costs += totalTeamCosts;
        }

        // Technology costs - one-time to first year, recurring distributed
        if (costs.techCosts) {
            costs.techCosts.forEach(tech => {
                const oneTime = parseFloat(tech['tech-onetime']) || 0;
                yearlyData[0].costs += oneTime;
                
                const monthly = parseFloat(tech['tech-monthly']) || 0;
                const duration = parseFloat(tech['tech-duration']) || 0;
                
                for (let i = 0; i < Math.min(duration/12, 5); i++) {
                    yearlyData[i].costs += monthly * 12;
                }
            });
        }

        // External costs - add to first year
        if (costs.externalCosts) {
            costs.externalCosts.forEach(external => {
                const oneTimeCost = parseFloat(external['external-cost']) || 0;
                const contingency = (parseFloat(external['external-contingency']) || 0) / 100;
                yearlyData[0].costs += oneTimeCost * (1 + contingency);
            });
        }
    }

    // Add maintenance costs from distribution if available
    if (distribution.maintenanceDistribution && distribution.maintenanceDistribution.values) {
        const maintenanceDist = distribution.maintenanceDistribution.values;
        const years = ['2025', '2026', '2027', '2028', '2029'];
        
        years.forEach((year, index) => {
            // Sum all maintenance cost types for this year
            const costTypes = ['maintenance-tech', 'maintenance-risk'];
            costTypes.forEach(type => {
                if (maintenanceDist[type] && maintenanceDist[type][year]) {
                    yearlyData[index].costs += parseFloat(maintenanceDist[type][year]) || 0;
                }
            });
        });
    } else {
        // Fallback: add recurring tech costs if no distribution
        if (costs.techCosts) {
            costs.techCosts.forEach(tech => {
                const monthly = parseFloat(tech['tech-monthly']) || 0;
                const duration = parseFloat(tech['tech-duration']) || 0;
                
                for (let i = 0; i < Math.min(duration/12, 5); i++) {
                    yearlyData[i].costs += monthly * 12;
                }
            });
        }
    }

    // Process values (unchanged)
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
    // If first year already has positive net flow, calculate within first year
    if (yearlyData[0].netFlow > 0) {
        // If first year has positive net flow, payback is fraction of year
        return yearlyData[0].costs / (yearlyData[0].oneOffValue + yearlyData[0].recurringValue);
    }
    
    // For subsequent years, check when accumulated becomes positive
    let accumulated = 0;
    for (let i = 0; i < yearlyData.length; i++) {
        accumulated += yearlyData[i].netFlow;
        if (accumulated >= 0) {
            if (i === 0) {
                return yearlyData[i].costs / (yearlyData[i].oneOffValue + yearlyData[i].recurringValue);
            } else {
                // If previous accumulated was negative, calculate fraction of current year
                const previousAccumulated = accumulated - yearlyData[i].netFlow;
                // Only if current net flow is positive
                if (yearlyData[i].netFlow > 0) {
                    return i + (Math.abs(previousAccumulated) / Math.abs(yearlyData[i].netFlow));
                } else {
                    return i;
                }
            }
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
    console.log('Starting PDF export with jsPDF...');
    
    // Get data
    const data = {
        projectName: document.getElementById('summaryProjectName').textContent,
        projectOwner: document.getElementById('summaryProjectOwner').textContent,
        department: document.getElementById('summaryDepartment').textContent,
        platforms: document.getElementById('summaryPlatforms').textContent,
        estimatedBy: document.getElementById('summaryEstimatedBy').textContent,
        roi: document.getElementById('roiValue').textContent,
        paybackPeriod: document.getElementById('paybackPeriod').textContent,
        netBenefit: document.getElementById('netBenefit').textContent,
        projectCost: document.getElementById('projectCostValue').textContent,
        tco: document.getElementById('tcoValue').textContent
    };

    // Get the assessment, cost and value data
    const assessment = JSON.parse(localStorage.getItem('projectAssessment') || '{}');
    const costs = JSON.parse(localStorage.getItem('projectCosts') || '{}');
    const values = JSON.parse(localStorage.getItem('projectValue') || '{}');
    const distribution = JSON.parse(localStorage.getItem('costDistribution') || '{}'); // Added this line to define distribution

    // Get financial overview data
    const financialTable = document.getElementById('financialOverview');
    const financialData = [];
    financialTable.querySelectorAll('tbody tr').forEach(row => {
        const rowData = Array.from(row.cells).map(cell => cell.textContent.trim());
        financialData.push(rowData);
    });

    // Create new jsPDF instance
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Set font
    doc.setFont("helvetica");
    
    // Add title
    doc.setFontSize(20);
    doc.setTextColor(240, 109, 13); // Etex Orange
    doc.text('Project Business Case Summary', 20, 20);
    
    // Add generation date
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 30);
    
    // Add line
    doc.setDrawColor(240, 109, 13);
    doc.line(20, 35, 190, 35);
    
    // Project Information section
    doc.setFontSize(16);
    doc.setTextColor(240, 109, 13);
    doc.text('Project Information', 20, 50);
    
    // Project details as table
    doc.autoTable({
        startY: 60,
        head: [['Field', 'Value']],
        body: [
            ['Project Name', data.projectName],
            ['Project Owner', data.projectOwner],
            ['Department', data.department],
            ['Platforms', data.platforms], 
            ['Estimated By', data.estimatedBy]
        ],
        theme: 'grid',
        headStyles: { 
            fillColor: [240, 109, 13],
            textColor: [255, 255, 255]
        },
        margin: { left: 30 },
        columnStyles: {
            0: { cellWidth: 50 }
        }
    });
    
    // Assessment Outcome section
doc.setFontSize(16);
doc.setTextColor(240, 109, 13);
doc.text('Assessment Outcome', 20, doc.lastAutoTable.finalY + 20);

let currentY = doc.lastAutoTable.finalY + 40;

// Aggressive text cleaning function
function aggressiveCleanText(text) {
    if (!text) return '';
    
    return text.toString()
        // Replace all types of quotes and apostrophes
        .replace(/[""''`´]/g, "'")
        // Replace all types of dashes
        .replace(/[–—−]/g, "-")
        // Replace special spaces
        .replace(/[\u00A0\u2000-\u200B\u2028\u2029]/g, " ")
        // Replace any remaining problematic Unicode characters
        .replace(/[^\x00-\x7F]/g, "")
        // Clean up multiple spaces
        .replace(/\s+/g, " ")
        // Remove any remaining control characters
        .replace(/[\x00-\x1F\x7F]/g, "")
        .trim();
}

// Helper function to wrap text at word boundaries with fixed character limits
function wrapText(text, maxCharsPerLine = 50) {
    const cleanText = aggressiveCleanText(text);
    const words = cleanText.split(' ');
    const lines = [];
    let currentLine = '';
    
    for (let word of words) {
        const testLine = currentLine ? currentLine + ' ' + word : word;
        
        if (testLine.length > maxCharsPerLine && currentLine) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    }
    
    if (currentLine) {
        lines.push(currentLine);
    }
    
    return lines;
}

// Helper function to check if we need a new page
function checkPageBreak(yPosition, additionalHeight = 20) {
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    
    if (yPosition + additionalHeight > pageHeight - margin) {
        doc.addPage();
        return 30; // Return new Y position after page break
    }
    return yPosition;
}

// Helper function to add a row with proper text wrapping and page break handling
function addAssessmentRow(label, value, startY) {
    // Estimate the height needed for this row
    const lines = wrapText(value || '', 50);
    const estimatedHeight = lines.length * 5 + 8;
    
    // Check if we need a new page
    startY = checkPageBreak(startY, estimatedHeight);
    
    // Set font explicitly before each operation
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    
    // Draw label
    doc.text(label + ':', 25, startY);
    
    // Draw each line
    lines.forEach((line, index) => {
        const lineY = startY + (index * 5);
        
        // Check if this line would go off the page
        if (lineY > doc.internal.pageSize.height - 30) {
            doc.addPage();
            const newLineY = 30 + (index * 5);
            
            // Reset font after page break
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(0, 0, 0);
            doc.text(line, 75, newLineY);
        } else {
            // Reset font for each line to prevent switching
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(0, 0, 0);
            doc.text(line, 75, lineY);
        }
    });
    
    // Calculate the next Y position
    const lastLineY = startY + ((lines.length - 1) * 5);
    if (lastLineY > doc.internal.pageSize.height - 30) {
        // If we ended on a new page, return position on new page
        return 30 + (lines.length * 5) + 8;
    } else {
        return startY + (lines.length * 5) + 8;
    }
}

// Add each assessment item
currentY = addAssessmentRow('Total Score', assessment.totalScore, currentY);

if (assessment.isRiskOverridden) {
    currentY = addAssessmentRow('Risk Adjustment', `${assessment.riskAdjustment} (Overridden)`, currentY);
    if (assessment.overrideReason) {
        currentY = addAssessmentRow('Override Reason', assessment.overrideReason, currentY);
    }
} else {
    currentY = addAssessmentRow('Risk Adjustment', assessment.riskAdjustment, currentY);
}

currentY = addAssessmentRow('PMO Approach', assessment.recommendedApproach, currentY);

if (values.comments && values.comments.trim()) {
    currentY = addAssessmentRow('Value Calculation Notes', values.comments, currentY);
}

// Add some spacing before the next section
doc.lastAutoTable = { finalY: currentY + 10 };

// Key Metrics section - New page
doc.addPage();
doc.setFontSize(16);
doc.setTextColor(240, 109, 13);
doc.text('Key Metrics', 20, 20);

// Metrics as table
doc.autoTable({
    startY: 30,
    head: [['Metric', 'Value']],
    body: [
        ['Project Cost', data.projectCost],
        ['Maintenance & support', data.tco],
        ['Risk Adjustment', assessment.riskAdjustment || '0%'],
        ['Total Cost of Ownership (TCO)', formatCurrency(
            parseCurrency(data.projectCost) + parseCurrency(data.tco)
        )],
        ['Return on Investment', data.roi],
        ['Payback Period', data.paybackPeriod],
        ['Net Benefit', data.netBenefit]
    ],
    theme: 'grid',
    headStyles: { 
        fillColor: [240, 109, 13],
        textColor: [255, 255, 255]
    },
    margin: { left: 30 },
    columnStyles: {
        0: { cellWidth: 80 }  // Width for metric names
    }
});



// Financial Overview section
doc.text('5 Year Financial Overview', 20, doc.lastAutoTable.finalY + 20);

// Financial overview table
doc.autoTable({
    startY: doc.lastAutoTable.finalY + 30,
    head: [[
        'Year',
        'Costs',
        'One-off Value',
        'Recurring Value',
        'Net Cash Flow',
        'Accumulated Benefit'
    ]],
    body: financialData,
    theme: 'grid',
    headStyles: { 
        fillColor: [240, 109, 13],
        textColor: [255, 255, 255]
    },
    margin: { left: 20, right: 20 },
    styles: {
        fontSize: 8,
        cellPadding: 2
    }
});
    // Cost Breakdown section - New page
    doc.addPage();
    doc.setFontSize(16);
    doc.setTextColor(240, 109, 13);
    doc.text('Cost Breakdown', 20, 20);

    // Team Costs
    if (costs.teamCosts) {
        doc.autoTable({
            startY: 30,
            head: [['Role', 'Persons', 'Validation Days', 'Scoping Days', 'Execution Days', 'Rate', 'Contingency', 'Total']],
            body: costs.teamCosts.map((member, index) => {
                const persons = parseFloat(member.persons) || 0;
                const rate = parseFloat(member.rate) || 0;
                const validationDays = parseFloat(member.validationDays) || 0;
                const scopingDays = parseFloat(member.scopingDays) || 0;
                const executionDays = parseFloat(member.executionDays) || 0;
                const contingency = parseFloat(member.contingency) || 0;
    
                // Calculate total with contingency
                const total = (persons * rate * (validationDays + scopingDays + executionDays)) * (1 + contingency/100);
    
                return [
                    index === 0 ? 'Project Manager' :
                    index === 1 ? 'Solution Architecture' :
                    index === 2 ? 'Business Analyst' :
                    index === 3 ? 'Developer' :
                    index === 4 ? 'Tester' :
                    index === 5 ? 'Local IT' : 'Unknown',
                    member.persons || '0',
                    member.validationDays || '0',
                    member.scopingDays || '0',
                    member.executionDays || '0',
                    formatCurrency(member.rate || 0),
                    `${member.contingency}%` || '0%',
                    formatCurrency(total)
                ];
            }),
            theme: 'grid',
            headStyles: { fillColor: [240, 109, 13], textColor: [255, 255, 255] },
            margin: { left: 20, right: 20 },
            styles: { fontSize: 8 }
        });
    }

    // Technology Costs
    if (costs.techCosts) {
        doc.text('Technology Costs', 20, doc.lastAutoTable.finalY + 20);
        doc.autoTable({
            startY: doc.lastAutoTable.finalY + 30,
            head: [['Item', 'One-time Cost', 'Monthly Cost', 'Duration', 'Description', 'Total']],
            body: costs.techCosts.map((tech, index) => [
                index === 0 ? 'Licenses' :
                index === 1 ? 'Infrastructure' :
                index === 2 ? 'Cloud Services' :
                index === 3 ? 'Tools' :
                index === 4 ? 'Data Migration' :
                index === 5 ? 'Application Maintenance' : 'Other',
                formatCurrency(tech['tech-onetime'] || 0),
                formatCurrency(tech['tech-monthly'] || 0),
                `${tech['tech-duration'] || 0} months`,
                tech.description || '',
                formatCurrency((parseFloat(tech['tech-onetime'] || 0) + 
                             (parseFloat(tech['tech-monthly'] || 0) * parseFloat(tech['tech-duration'] || 0))))
            ]),
            theme: 'grid',
            headStyles: { fillColor: [240, 109, 13], textColor: [255, 255, 255] },
            margin: { left: 20, right: 20 },
            styles: { fontSize: 8 }
        });
    }

    // External Costs
    if (costs.externalCosts) {
        doc.text('External Costs', 20, doc.lastAutoTable.finalY + 20);
        doc.autoTable({
            startY: doc.lastAutoTable.finalY + 30,
            head: [['Item', 'One-time Cost', 'Monthly Cost', 'Duration', 'Contingency', 'Description', 'Total']],
            body: costs.externalCosts.map((ext, index) => {
                const oneTime = parseFloat(ext['external-cost']) || 0;
                const monthly = parseFloat(ext['external-monthly']) || 0;
                const duration = parseFloat(ext['external-duration']) || 0;
                const contingency = parseFloat(ext['external-contingency']) || 0;

                // Calculate total with contingency
                const monthlyTotal = monthly * duration;
                const subtotal = oneTime + monthlyTotal;
                const total = subtotal * (1 + contingency/100);

                return [
                    index === 0 ? 'Vendors' :
                    index === 1 ? 'Consultants' :
                    index === 2 ? 'Training & expenses' : 'Other',
                    formatCurrency(oneTime),
                    formatCurrency(monthly),
                    `${duration} months`,
                    `${contingency}%`,
                    ext.description || '',
                    formatCurrency(total)
                ];
            }),
            theme: 'grid',
            headStyles: { fillColor: [240, 109, 13], textColor: [255, 255, 255] },
            margin: { left: 20, right: 20 },
            styles: { fontSize: 8 }
        });
    }
// Add Cost Distribution section - NEW
if (distribution && Object.keys(distribution).length > 0) {
    doc.setFontSize(16);
    doc.setTextColor(240, 109, 13);
    doc.text('Cost Distribution', 20, doc.lastAutoTable.finalY + 20);
    
    // Prepare CAPEX/OPEX data
    const isCapexProject = costs.isCapex || false;
    const projectTotal = costs.summary?.totalProjectCost || 0;
    
    // Calculate CAPEX and OPEX amounts based on actual validation vs scoping/execution costs
    let capexAmount = 0;
    let opexAmount = 0;
    
    if (isCapexProject) {
        // Calculate validation costs (OPEX) vs scoping+execution costs (CAPEX)
        let validationCost = 0;
        let scopingExecutionCost = 0;
        
        if (costs.teamCosts) {
            costs.teamCosts.forEach(member => {
                const validationDays = parseFloat(member.validationDays) || 0;
                const scopingDays = parseFloat(member.scopingDays) || 0;
                const executionDays = parseFloat(member.executionDays) || 0;
                const persons = parseFloat(member.persons) || 0;
                const rate = parseFloat(member.rate) || 0;
                const contingency = parseFloat(member.contingency) || 0;
                
                validationCost += (validationDays * persons * rate * (1 + contingency/100));
                scopingExecutionCost += ((scopingDays + executionDays) * persons * rate * (1 + contingency/100));
            });
        }
        
        // For CAPEX projects, validation costs are OPEX
        opexAmount = validationCost;
        capexAmount = projectTotal - opexAmount;
    } else {
        // For non-CAPEX projects, everything is OPEX
        opexAmount = projectTotal;
        capexAmount = 0;
    }
    
    // Calculate percentages
    let capexPercent = 0;
    let opexPercent = 0;
    
    if (projectTotal > 0) {
        capexPercent = Math.round((capexAmount / projectTotal) * 100);
        opexPercent = Math.round((opexAmount / projectTotal) * 100);
    }
    
    // Calculate CAPEX/OPEX ratios for use in yearly distribution
    const capexRatio = projectTotal > 0 ? capexAmount / projectTotal : 0;
    const opexRatio = projectTotal > 0 ? opexAmount / projectTotal : 0;
    
    // Create CAPEX/OPEX summary table
    const capexOpexSummary = [
        ['CAPEX/OPEX Split', `${capexPercent}% / ${opexPercent}%`],
        ['CAPEX Amount', formatCurrency(capexAmount)],
        ['OPEX Amount', formatCurrency(opexAmount)]
    ];
    
    doc.autoTable({
        startY: doc.lastAutoTable.finalY + 30,
        head: [['Cost Classification', 'Value']],
        body: capexOpexSummary,
        theme: 'grid',
        headStyles: { 
            fillColor: [240, 109, 13],
            textColor: [255, 255, 255]
        },
        margin: { left: 30 },
        columnStyles: {
            0: { cellWidth: 50 }
        }
    });
    
    // Add yearly distribution if available
    if (distribution.projectDistribution && distribution.projectDistribution.values) {
        // Prepare yearly distribution data
        const yearlyData = [];
        const years = ['2025', '2026', '2027', '2028', '2029'];
        
        years.forEach(year => {
            // Use data from the distribution object if available
            let yearAmount = 0;
            
            // Sum up all cost types for this year
            const costTypes = ['project-team', 'project-tech', 'project-external', 'project-risk'];
            costTypes.forEach(type => {
                if (distribution.projectDistribution.values[type] && 
                    distribution.projectDistribution.values[type][year]) {
                    yearAmount += parseFloat(distribution.projectDistribution.values[type][year]) || 0;
                }
            });
            
            if (yearAmount > 0) {
                // Calculate CAPEX and OPEX for this year using the calculated ratios
                const yearCapexAmount = isCapexProject ? yearAmount * capexRatio : 0;
                const yearOpexAmount = isCapexProject ? yearAmount * opexRatio : yearAmount;
                
                yearlyData.push([
                    year,
                    formatCurrency(yearAmount),
                    formatCurrency(yearCapexAmount),
                    formatCurrency(yearOpexAmount)
                ]);
            }
        });
        
        if (yearlyData.length > 0) {
            doc.autoTable({
                startY: doc.lastAutoTable.finalY + 10,
                head: [['Year', 'Total', 'CAPEX', 'OPEX']],
                body: yearlyData,
                theme: 'grid',
                headStyles: { 
                    fillColor: [240, 109, 13],
                    textColor: [255, 255, 255]
                },
                margin: { left: 30 }
            });
        }
    }
}
    // Value Breakdown section - New page
    doc.addPage();
    doc.setFontSize(16);
    doc.setTextColor(240, 109, 13);
    doc.text('Value Breakdown', 20, 20);

    // One-off Values
    if (values.oneOff) {
        doc.autoTable({
            startY: 30,
            head: [['Category', 'Amount', 'Description']],
            body: values.oneOff.map((item, index) => [
                index === 0 ? 'Hardware savings' :
                index === 1 ? 'Inventory reduction' :
                index === 2 ? 'Asset sale' : 'Other one-off value',
                formatCurrency(item.amount || 0),
                item.description || ''
            ]),
            theme: 'grid',
            headStyles: { fillColor: [240, 109, 13], textColor: [255, 255, 255] },
            margin: { left: 20, right: 20 }
        });
    }

    // Recurring Values
    if (values.recurring) {
        doc.text('Recurring Values', 20, doc.lastAutoTable.finalY + 20);
        doc.autoTable({
            startY: doc.lastAutoTable.finalY + 30,
            head: [['Category', 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Description']],
            body: values.recurring.map((item, index) => [
                index === 0 ? 'License cost reduction' :
                index === 1 ? 'Maintenance savings' :
                index === 2 ? 'Efficiency gains (FTE)' :
                index === 3 ? 'Other value' : 'Additional value',
                formatCurrency(item.year1 || 0),
                formatCurrency(item.year2 || 0),
                formatCurrency(item.year3 || 0),
                formatCurrency(item.year4 || 0),
                formatCurrency(item.year5 || 0),
                item.description || ''
            ]),
            theme: 'grid',
            headStyles: { fillColor: [240, 109, 13], textColor: [255, 255, 255] },
            margin: { left: 20, right: 20 },
            styles: { fontSize: 8 }
        });
    }
    
    

    // Charts section - New page
    doc.addPage();
    doc.setFontSize(16);
    doc.setTextColor(240, 109, 13);
    doc.text('Financial Analysis Charts', 20, 20);

    // Add charts
    const cashFlowCanvas = document.getElementById('cashFlowChart');
    const accumulatedCanvas = document.getElementById('accumulatedBenefitChart');

    if (cashFlowCanvas && accumulatedCanvas) {
        const cashFlowImage = cashFlowCanvas.toDataURL('image/png');
        doc.addImage(cashFlowImage, 'PNG', 20, 40, 170, 100);

        const accumulatedImage = accumulatedCanvas.toDataURL('image/png');
        doc.addImage(accumulatedImage, 'PNG', 20, 160, 170, 100);
    }

    // Save the PDF with project name in filename
    try {
        const filename = `${data.projectName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_business_case.pdf`;
        doc.save(filename);
        console.log('PDF generated successfully');
    } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Error generating PDF. Please try again.');
    }
}

function loadProjectInfo() {
    const assessment = JSON.parse(localStorage.getItem('projectAssessment') || '{}');
    const valueData = JSON.parse(localStorage.getItem('projectValue') || '{}');

    if (Object.keys(assessment).length === 0) {
        showNoAssessmentMessage();
        return;
    }

    document.getElementById('summaryProjectName').textContent = assessment.projectName || 'No project name';
    document.getElementById('summaryProjectOwner').textContent = assessment.projectOwner || 'No owner specified';
    document.getElementById('summaryDepartment').textContent = assessment.department || 'No department specified';
    document.getElementById('summaryPlatforms').textContent = assessment.platforms ? assessment.platforms.join(', ') : 'None selected';
    document.getElementById('summaryEstimatedBy').textContent = assessment.estimatedBy || 'Not specified';
    
    // Add this line to update risk adjustment display if a field with this ID exists
    const riskElem = document.getElementById('summaryRiskAdjustment');
    if (riskElem && assessment.riskAdjustment) {
        riskElem.textContent = assessment.riskAdjustment;
        
        // Add override reason if available
        if (assessment.isRiskOverridden && assessment.overrideReason) {
            const reasonElem = document.createElement('div');
            reasonElem.className = 'risk-override-reason';
            reasonElem.innerHTML = `<strong>Override Reason:</strong> ${assessment.overrideReason}`;
            riskElem.parentNode.appendChild(reasonElem);
        }
    }
    
    // Display value comments if available
    const commentsDisplay = document.getElementById('valueCommentsDisplay');
    if (commentsDisplay) {
        if (valueData.comments && valueData.comments.trim()) {
            commentsDisplay.innerHTML = `<p>${valueData.comments.replace(/\n/g, '<br>')}</p>`;
        } else {
            commentsDisplay.innerHTML = '<p class="no-comments">No value calculation comments provided.</p>';
        }
    }
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