// distribution.js
document.addEventListener('DOMContentLoaded', function() {
    // Load project information from assessment
    loadProjectInfo();
    
    // Load saved distribution if available
    loadSavedDistribution();

    // Add button event listeners
    document.getElementById('saveDistribution').addEventListener('click', saveDistribution);
    document.getElementById('resetDistribution').addEventListener('click', resetDistribution);

    // Setup next button
    const nextButton = document.getElementById('nextButton');
    if (nextButton) {
        nextButton.disabled = !localStorage.getItem('costDistribution');
        nextButton.onclick = () => window.location.href = 'value.html';
    }
});

function loadProjectInfo() {
    const assessment = JSON.parse(localStorage.getItem('projectAssessment') || '{}');
    const costs = JSON.parse(localStorage.getItem('projectCosts') || '{}');

    // Check if we have assessment data
    if (Object.keys(assessment).length === 0) {
        showNoAssessmentMessage();
        return;
    }

    // Check if we have cost data
    if (Object.keys(costs).length === 0) {
        showNoCostsMessage();
        return;
    }

    document.getElementById('summaryProjectName').textContent = assessment.projectName || 'No project name';
    document.getElementById('summaryProjectOwner').textContent = assessment.projectOwner || 'No owner specified';
    document.getElementById('summaryDepartment').textContent = assessment.department || 'No department specified';
    document.getElementById('summaryEstimatedBy').textContent = assessment.estimatedBy || 'Not specified';
    
    // Get the risk adjustment percentage
    let riskPercentage = 0;
    let riskText = '0%';
    
    if (assessment.riskAdjustment) {
        riskText = assessment.riskAdjustment;
        riskPercentage = parseFloat(riskText.replace('%', '')) / 100;
    }
    
    // Update the risk adjustment info in the UI
    document.getElementById('risk-adjustment-info').textContent = riskText;
    document.getElementById('maintenance-risk-adjustment-info').textContent = riskText;
    
    // Store risk percentage for later calculations
    window.riskPercentage = riskPercentage;
    
    // Store CAPEX/OPEX information globally
    window.isCapexProject = costs.isCapex || false;
    
    // Store the actual CAPEX/OPEX amounts if available
    if (costs.summary && costs.summary.capexTotal !== undefined && costs.summary.opexTotal !== undefined) {
        window.capexAmount = costs.summary.capexTotal;
        window.opexAmount = costs.summary.opexTotal;
    }
    
    // Extract costs from the costs data
    loadProjectCosts(costs, riskPercentage);
    loadMaintenanceCosts(costs, riskPercentage);
    
    // Add event listeners to all inputs
    setupInputListeners();
}

function loadProjectCosts(costs, riskPercentage) {
    // Extract project costs (team execution, one-time tech, external)
    let teamCosts = 0;
    let techCosts = 0;
    let externalCosts = 0;
    let riskCosts = 0;
    let totalProjectAmount = 0;
    
    // If we have a summary with total project cost, use that directly
    if (costs.summary && costs.summary.totalProjectCost) {
        totalProjectAmount = costs.summary.totalProjectCost;
        
        // Calculate team, tech, external, and risk costs proportionally
        // if they exist in the summary
        if (costs.summary.teamCosts) teamCosts = costs.summary.teamCosts;
        if (costs.summary.techCosts) techCosts = costs.summary.techCosts; 
        if (costs.summary.externalCosts) externalCosts = costs.summary.externalCosts;
        if (costs.summary.riskAmount) riskCosts = costs.summary.riskAmount;
    } else {
        // Original calculation logic if no summary exists
        // [existing code]
    }
    
    // Load the CAPEX/OPEX breakdown
    let capexAmount = totalProjectAmount;
    let opexAmount = 0;
    
    if (costs.isCapex) {
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
        capexAmount = totalProjectAmount - opexAmount;
    } else {
        // For non-CAPEX projects, everything is OPEX
        opexAmount = totalProjectAmount;
        capexAmount = 0;
    }
    
    // Store the CAPEX/OPEX ratio for distribution
    window.capexAmount = capexAmount;
    window.opexAmount = opexAmount;
    window.capexRatio = totalProjectAmount > 0 ? capexAmount / totalProjectAmount : 0;
    window.opexRatio = totalProjectAmount > 0 ? opexAmount / totalProjectAmount : 0;
    
    // Update UI with project costs
    document.getElementById('totalProjectAmount').textContent = formatCurrency(totalProjectAmount);
    document.getElementById('total-project-display').textContent = formatCurrency(totalProjectAmount);
    document.getElementById('project-remaining-amount').textContent = formatCurrency(totalProjectAmount);
    
    // Set individual cost type amounts
    document.getElementById('project-team-available').textContent = formatCurrency(teamCosts);
    document.getElementById('project-tech-available').textContent = formatCurrency(techCosts);
    document.getElementById('project-external-available').textContent = formatCurrency(externalCosts);
    document.getElementById('project-risk-available').textContent = formatCurrency(riskCosts);
    document.getElementById('project-total-available').textContent = formatCurrency(totalProjectAmount);
    
    // Store amounts for calculations
    window.totalProjectAmount = totalProjectAmount;
    window.projectCostTypeAmounts = {
        'project-team': teamCosts,
        'project-tech': techCosts,
        'project-external': externalCosts,
        'project-risk': riskCosts
    };
    
    // Update CAPEX/OPEX ratio in the UI
    const capexPercent = Math.round(window.capexRatio * 100);
    const opexPercent = Math.round(window.opexRatio * 100);
    
    document.getElementById('capex-opex-ratio').textContent = 
        `${formatCurrency(capexAmount)} / ${formatCurrency(opexAmount)} (${capexPercent}% / ${opexPercent}%)`;
}

function loadMaintenanceCosts(costs, riskPercentage) {
    // Extract maintenance costs (recurring tech only)
    let recurringTechCosts = 0;
    let riskCosts = 0;
    let totalMaintenanceAmount = 0;
    
    // If summary has a specific maintenance cost, use that directly
    if (costs.summary && costs.summary.totalMaintenanceCost !== undefined) {
        totalMaintenanceAmount = costs.summary.totalMaintenanceCost;
        
        // Recalculate the components based on the total
        recurringTechCosts = totalMaintenanceAmount / (1 + riskPercentage);
        riskCosts = totalMaintenanceAmount - recurringTechCosts;
    } else {
        // Original calculation logic
        if (costs.techCosts) {
            // Extract recurring tech costs only
            costs.techCosts.forEach(tech => {
                const monthly = parseFloat(tech['tech-monthly']) || 0;
                const duration = parseFloat(tech['tech-duration']) || 0;
                
                recurringTechCosts += monthly * duration;
            });
        }
        
        // Calculate base total and risk amount
        const totalBeforeRisk = recurringTechCosts;
        riskCosts = totalBeforeRisk * riskPercentage;
        totalMaintenanceAmount = totalBeforeRisk + riskCosts;
    }
    
    // Update UI with maintenance costs
    document.getElementById('totalMaintenanceAmount').textContent = formatCurrency(totalMaintenanceAmount);
    document.getElementById('total-maintenance-display').textContent = formatCurrency(totalMaintenanceAmount);
    document.getElementById('maintenance-remaining-amount').textContent = formatCurrency(totalMaintenanceAmount);
    
    // Set individual cost type amounts - only tech and risk for maintenance
    document.getElementById('maintenance-tech-available').textContent = formatCurrency(recurringTechCosts);
    document.getElementById('maintenance-risk-available').textContent = formatCurrency(riskCosts);
    document.getElementById('maintenance-total-available').textContent = formatCurrency(totalMaintenanceAmount);
    
    // Store amounts for calculations
    window.totalMaintenanceAmount = totalMaintenanceAmount;
    window.maintenanceCostTypeAmounts = {
        'maintenance-tech': recurringTechCosts,
        'maintenance-risk': riskCosts
    };
}

function setupInputListeners() {
    // Project costs listeners
    document.querySelectorAll('#projectDistributionTable .year-input').forEach(input => {
        input.addEventListener('input', updateProjectTotals);
    });
    
    // Maintenance costs listeners
    document.querySelectorAll('#maintenanceDistributionTable .year-input').forEach(input => {
        input.addEventListener('input', updateMaintenanceTotals);
    });
}

function updateProjectTotals() {
    console.log('Updating project totals...');
    
    // Track row totals (by cost type)
    const rowTotals = {
        'project-team': 0,
        'project-tech': 0,
        'project-external': 0,
        'project-risk': 0
    };
    
    // Track column totals (by year)
    const yearTotals = {
        2025: 0,
        2026: 0,
        2027: 0,
        2028: 0,
        2029: 0
    };
    
    let grandTotal = 0;
    
    // Process all inputs
    document.querySelectorAll('#projectDistributionTable .year-input').forEach(input => {
        const value = input.value.trim() === '' ? 0 : parseFloat(input.value);
        if (isNaN(value)) return;
        
        const type = input.dataset.type;
        const year = input.dataset.year;
        
        console.log(`Processing project input: type=${type}, year=${year}, value=${value}`);
        
        // Add to row total
        if (rowTotals[type] !== undefined) {
            rowTotals[type] += value;
        }
        
        // Add to year total
        if (yearTotals[year] !== undefined) {
            yearTotals[year] += value;
        }
        
        // Add to grand total
        grandTotal += value;
    });
    
    console.log('Project row totals:', rowTotals);
    console.log('Project year totals:', yearTotals);
    console.log('Project grand total:', grandTotal);
    
    // Update row totals
    for (const type in rowTotals) {
        const totalCell = document.getElementById(`${type}-total`);
        if (totalCell) {
            totalCell.textContent = formatCurrency(rowTotals[type]);
        }
        
        // Calculate and update available amounts
        if (window.projectCostTypeAmounts && window.projectCostTypeAmounts[type] !== undefined) {
            const originalAmount = window.projectCostTypeAmounts[type];
            const remainingAmount = originalAmount - rowTotals[type];
            
            const availableElement = document.getElementById(`${type}-available`);
            if (availableElement) {
                if (Math.abs(remainingAmount) < 0.01) {
                    availableElement.textContent = formatCurrency(0);
                    availableElement.className = 'available-amount balanced';
                } else if (remainingAmount < 0) {
                    availableElement.textContent = formatCurrency(remainingAmount);
                    availableElement.className = 'available-amount negative';
                } else {
                    availableElement.textContent = formatCurrency(remainingAmount);
                    availableElement.className = 'available-amount';
                }
            }
        }
    }
    
    // Update year totals
    for (const year in yearTotals) {
        const totalCell = document.getElementById(`project-total-${year}`);
        if (totalCell) {
            totalCell.textContent = formatCurrency(yearTotals[year]);
        } else {
            console.warn(`Project total cell not found for year ${year}`);
        }
    }
    
    // Update grand total
    const grandTotalCell = document.getElementById('project-grand-total');
    if (grandTotalCell) {
        grandTotalCell.textContent = formatCurrency(grandTotal);
    }
    
    // Update distributed amount
    const distributedAmountCell = document.getElementById('project-distributed-amount');
    if (distributedAmountCell) {
        distributedAmountCell.textContent = formatCurrency(grandTotal);
    }

     // Calculate and update remaining amount
     const remaining = window.totalProjectAmount - grandTotal;
     let displayRemaining;
     let remainingClass;
     
     if (Math.abs(remaining) < 0.01) {
         displayRemaining = 0;
         remainingClass = 'stat-value balanced';
     } else if (remaining < 0) {
         displayRemaining = remaining;
         remainingClass = 'stat-value negative';
     } else {
         displayRemaining = remaining;
         remainingClass = 'stat-value';
     }
     
     const remainingCell = document.getElementById('project-remaining-amount');
     if (remainingCell) {
         remainingCell.textContent = formatCurrency(displayRemaining);
         remainingCell.className = remainingClass;
     }
     
     const totalAvailableCell = document.getElementById('project-total-available');
     if (totalAvailableCell) {
         totalAvailableCell.textContent = formatCurrency(displayRemaining);
         totalAvailableCell.className = remainingClass.replace('stat-value', 'available-amount');
     }
     
     // Update summary
     updateSummary();
 }
 
 function updateMaintenanceTotals() {
     console.log('Updating maintenance totals...');
     
     // Track row totals (by cost type)
     const rowTotals = {
         'maintenance-team': 0,
         'maintenance-tech': 0,
         'maintenance-risk': 0
     };
     
     // Track column totals (by year)
     const yearTotals = {
         2025: 0,
         2026: 0,
         2027: 0,
         2028: 0,
         2029: 0
     };
     
     let grandTotal = 0;
     
     // Process all inputs
     document.querySelectorAll('#maintenanceDistributionTable .year-input').forEach(input => {
         const value = input.value.trim() === '' ? 0 : parseFloat(input.value);
         if (isNaN(value)) return;
         
         const type = input.dataset.type;
         const year = input.dataset.year;
         
         console.log(`Processing maintenance input: type=${type}, year=${year}, value=${value}`);
         
         // Add to row total
         if (rowTotals[type] !== undefined) {
             rowTotals[type] += value;
         }
         
         // Add to year total
         if (yearTotals[year] !== undefined) {
             yearTotals[year] += value;
         }
         
         // Add to grand total
         grandTotal += value;
     });
     
     console.log('Maintenance row totals:', rowTotals);
     console.log('Maintenance year totals:', yearTotals);
     console.log('Maintenance grand total:', grandTotal);
     
     // Update row totals
     for (const type in rowTotals) {
         const totalCell = document.getElementById(`${type}-total`);
         if (totalCell) {
             totalCell.textContent = formatCurrency(rowTotals[type]);
         }
         
         // Calculate and update available amounts
         if (window.maintenanceCostTypeAmounts && window.maintenanceCostTypeAmounts[type] !== undefined) {
             const originalAmount = window.maintenanceCostTypeAmounts[type];
             const remainingAmount = originalAmount - rowTotals[type];
             
             const availableElement = document.getElementById(`${type}-available`);
             if (availableElement) {
                 if (Math.abs(remainingAmount) < 0.01) {
                     availableElement.textContent = formatCurrency(0);
                     availableElement.className = 'available-amount balanced';
                 } else if (remainingAmount < 0) {
                     availableElement.textContent = formatCurrency(remainingAmount);
                     availableElement.className = 'available-amount negative';
                 } else {
                     availableElement.textContent = formatCurrency(remainingAmount);
                     availableElement.className = 'available-amount';
                 }
             }
         }
     }
     
     // Update year totals
     for (const year in yearTotals) {
         const totalCell = document.getElementById(`maintenance-total-${year}`);
         if (totalCell) {
             totalCell.textContent = formatCurrency(yearTotals[year]);
         } else {
             console.warn(`Maintenance total cell not found for year ${year}`);
         }
     }
     
     // Update grand total
     const grandTotalCell = document.getElementById('maintenance-grand-total');
     if (grandTotalCell) {
         grandTotalCell.textContent = formatCurrency(grandTotal);
     }
     
     // Update distributed amount
     const distributedAmountCell = document.getElementById('maintenance-distributed-amount');
     if (distributedAmountCell) {
         distributedAmountCell.textContent = formatCurrency(grandTotal);
     }
     
     // Calculate and update remaining amount
     const remaining = window.totalMaintenanceAmount - grandTotal;
     let displayRemaining;
     let remainingClass;
     
     if (Math.abs(remaining) < 0.01) {
         displayRemaining = 0;
         remainingClass = 'stat-value balanced';
     } else if (remaining < 0) {
         displayRemaining = remaining;
         remainingClass = 'stat-value negative';
     } else {
         displayRemaining = remaining;
         remainingClass = 'stat-value';
     }
     
     const remainingCell = document.getElementById('maintenance-remaining-amount');
     if (remainingCell) {
         remainingCell.textContent = formatCurrency(displayRemaining);
         remainingCell.className = remainingClass;
     }
     
     const totalAvailableCell = document.getElementById('maintenance-total-available');
     if (totalAvailableCell) {
         totalAvailableCell.textContent = formatCurrency(displayRemaining);
         totalAvailableCell.className = remainingClass.replace('stat-value', 'available-amount');
     }
     
     // Update summary
     updateSummary();
 }
 
 function collectProjectDistribution() {
     const distribution = {};
     
     // Store risk adjustment information
     distribution.riskAdjustment = {
         percentage: window.riskPercentage * 100,
         multiplier: 1 + window.riskPercentage
     };
     
     // Collect values entered by user
     distribution.values = {};
     const costTypes = ['project-team', 'project-tech', 'project-external', 'project-risk'];
     costTypes.forEach(type => {
         distribution.values[type] = {};
         
         // Get values for all years
         for (let year = 2025; year <= 2029; year++) {
             const selector = `.year-input[data-type="${type}"][data-year="${year}"]`;
             const input = document.querySelector(selector);
             if (input) {
                 const value = input.value.trim() === '' ? 0 : parseFloat(input.value);
                 distribution.values[type][year] = isNaN(value) ? 0 : value;
             }
         }
     });
     
     // Add totals
     distribution.totals = {
         team: parseCurrency(document.getElementById('project-team-total').textContent),
         tech: parseCurrency(document.getElementById('project-tech-total').textContent),
         external: parseCurrency(document.getElementById('project-external-total').textContent),
         risk: parseCurrency(document.getElementById('project-risk-total').textContent),
         grandTotal: parseCurrency(document.getElementById('project-grand-total').textContent)
     };
     
     return distribution;
 }
 
 function collectMaintenanceDistribution() {
    const distribution = {};
    
    // Store risk adjustment information
    distribution.riskAdjustment = {
        percentage: window.riskPercentage * 100,
        multiplier: 1 + window.riskPercentage
    };
    
    // Collect values entered by user
    distribution.values = {};
    const costTypes = ['maintenance-tech', 'maintenance-risk'];  // Removed 'maintenance-team'
    costTypes.forEach(type => {
        distribution.values[type] = {};
        
        // Get values for all years
        for (let year = 2025; year <= 2029; year++) {
            const selector = `.year-input[data-type="${type}"][data-year="${year}"]`;
            const input = document.querySelector(selector);
            if (input) {
                const value = input.value.trim() === '' ? 0 : parseFloat(input.value);
                distribution.values[type][year] = isNaN(value) ? 0 : value;
            }
        }
    });
    
    // Add totals
    distribution.totals = {
        tech: parseCurrency(document.getElementById('maintenance-tech-total').textContent),
        risk: parseCurrency(document.getElementById('maintenance-risk-total').textContent),
        grandTotal: parseCurrency(document.getElementById('maintenance-grand-total').textContent)
    };
    
    return distribution;
}
 
 function saveDistribution() {
     // Get all distribution data
     const distributionData = {
         projectDistribution: collectProjectDistribution(),
         maintenanceDistribution: collectMaintenanceDistribution(),
         timestamp: new Date().toISOString()
     };
     
     // Save to localStorage
     localStorage.setItem('costDistribution', JSON.stringify(distributionData));
     
     // Show save confirmation and enable next button
     const saveButton = document.getElementById('saveDistribution');
     const nextButton = document.getElementById('nextButton');
     
     saveButton.textContent = 'Saved!';
     saveButton.disabled = true;
     nextButton.disabled = false;
     
     setTimeout(() => {
         saveButton.textContent = 'Save';
         saveButton.disabled = false;
     }, 2000);
 }
 
 function loadSavedDistribution() {
    const saved = localStorage.getItem('costDistribution');
    if (!saved) return;
    
    try {
        const distribution = JSON.parse(saved);
        
        // Load project distribution values if available
        if (distribution.projectDistribution) {
            const project = distribution.projectDistribution;
            
            // Load values if they exist in the saved data
            if (project.values) {
                const costTypes = ['project-team', 'project-tech', 'project-external', 'project-risk'];
                costTypes.forEach(type => {
                    if (!project.values[type]) return;
                    
                    for (let year = 2025; year <= 2029; year++) {
                        if (project.values[type][year] !== undefined) {
                            const selector = `.year-input[data-type="${type}"][data-year="${year}"]`;
                            const input = document.querySelector(selector);
                            if (input) {
                                input.value = project.values[type][year];
                            }
                        }
                    }
                });
            }
        }
        
        // Load maintenance distribution values if available
        if (distribution.maintenanceDistribution) {
            const maintenance = distribution.maintenanceDistribution;
            
            // Load values if they exist in the saved data
            if (maintenance.values) {
                const costTypes = ['maintenance-tech', 'maintenance-risk'];
                costTypes.forEach(type => {
                    if (!maintenance.values[type]) return;
                    
                    for (let year = 2025; year <= 2029; year++) {
                        if (maintenance.values[type][year] !== undefined) {
                            const selector = `.year-input[data-type="${type}"][data-year="${year}"]`;
                            const input = document.querySelector(selector);
                            if (input) {
                                input.value = maintenance.values[type][year];
                            }
                        }
                    }
                });
            }
        }
        
        // Update all totals
        updateProjectTotals();
        updateMaintenanceTotals();
        updateSummary(); // Ensure summary is updated with CAPEX/OPEX values
    } catch (e) {
        console.error('Error loading saved distribution:', e);
    }
}
 
 function resetDistribution() {
     if (confirm('Are you sure you want to reset the cost distribution? This action cannot be undone.')) {
         // Clear all inputs
         document.querySelectorAll('.year-input').forEach(input => {
             input.value = '';
         });
         
         // Reset totals
         updateProjectTotals();
         updateMaintenanceTotals();
         
         // Remove saved distribution
         localStorage.removeItem('costDistribution');
         
         // Disable next button
         document.getElementById('nextButton').disabled = true;
     }
 }
 
 function showNoAssessmentMessage() {
     const container = document.querySelector('.distribution-container');
     container.innerHTML = `
         <div class="alert alert-warning">
             <h2>No Assessment Data Found</h2>
             <p>Please complete the project assessment first before proceeding with cost distribution.</p>
             <a href="assessment.html" class="btn-primary">Go to Assessment</a>
         </div>
     `;
 }
 
 function showNoCostsMessage() {
     const container = document.querySelector('.distribution-container');
     container.innerHTML = `
         <div class="alert alert-warning">
             <h2>No Cost Data Found</h2>
             <p>Please complete the cost estimation first before proceeding with cost distribution.</p>
             <a href="costs.html" class="btn-primary">Go to Costs</a>
         </div>
     `;
 }
 
 function updateSummary() {
    // Get project year amounts
    const projectYearsSummary = document.getElementById('project-years-summary');
    projectYearsSummary.innerHTML = ''; // Clear previous content
    
    // Determine CAPEX/OPEX based on project settings and actual cost types
    const projectTotal = parseCurrency(document.getElementById('project-grand-total').textContent) || 0;
    
    // Use the stored CAPEX/OPEX ratios
    const capexRatio = window.capexRatio || 0;
    const opexRatio = window.opexRatio || 0;
    
    let hasProjectValues = false;
    for (let year = 2025; year <= 2029; year++) {
        const yearAmount = parseCurrency(document.getElementById(`project-total-${year}`).textContent) || 0;
        
        if (yearAmount > 0) {
            hasProjectValues = true;
            const yearElement = document.createElement('div');
            yearElement.className = 'year-distribution';
            
            // Calculate CAPEX and OPEX amounts for this year using the actual ratios
            const yearCapexAmount = yearAmount * capexRatio;
            const yearOpexAmount = yearAmount * opexRatio;
            
            yearElement.innerHTML = `
                <p class="year-label">${year}:</p>
                <div class="year-split">
                    <p>Total: <strong>${formatCurrency(yearAmount)}</strong></p>
                    <p>CAPEX: <strong>${formatCurrency(yearCapexAmount)}</strong></p>
                    <p>OPEX: <strong>${formatCurrency(yearOpexAmount)}</strong></p>
                </div>
            `;
            projectYearsSummary.appendChild(yearElement);
        }
    }
    
    if (!hasProjectValues) {
        projectYearsSummary.innerHTML = '<p>No project costs distributed</p>';
    }
    
    // Rest of the function remains the same
    // ...
    
    // Calculate overall CAPEX/OPEX totals using the actual ratios
    let capexAmount = projectTotal * capexRatio;
    let opexAmount = projectTotal * opexRatio;
    
    // Calculate percentages
    let capexPercent = 0;
    let opexPercent = 0;
    
    if (projectTotal > 0) {
        capexPercent = Math.round((capexAmount / projectTotal) * 100);
        opexPercent = Math.round((opexAmount / projectTotal) * 100);
    }
    
    // Update the CAPEX/OPEX display
    const capexOpexElement = document.getElementById('summary-capex-opex');
    if (capexOpexElement) {
        capexOpexElement.textContent = `${formatCurrency(capexAmount)} / ${formatCurrency(opexAmount)} (${capexPercent}% / ${opexPercent}%)`;
    }
    
    // Also update the CAPEX/OPEX in the stats section
    const capexOpexRatioElement = document.getElementById('capex-opex-ratio');
    if (capexOpexRatioElement) {
        capexOpexRatioElement.textContent = `${formatCurrency(capexAmount)} / ${formatCurrency(opexAmount)} (${capexPercent}% / ${opexPercent}%)`;
    }
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
 
 function formatNumber(amount) {
     return new Intl.NumberFormat('en-EU', {
         minimumFractionDigits: 0,
         maximumFractionDigits: 0
     }).format(amount);
 }
 
 function parseCurrency(value) {
     if (!value || typeof value !== 'string') return 0;
     return Number(value.replace(/[^0-9.-]+/g, '')) || 0;
 }