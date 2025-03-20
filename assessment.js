// assessment.js
document.addEventListener('DOMContentLoaded', function () {
    // Set default date to today
    document.getElementById('date').valueAsDate = new Date();

    // Initialize with saved data if available
    loadSavedAssessment();

    // Add event listeners to all score selects
    document.querySelectorAll('.score-select').forEach(select => {
        select.addEventListener('change', calculateScore);
    });

    // Add event listeners to buttons
    document.getElementById('saveAssessment').addEventListener('click', saveAssessment);
    document.getElementById('resetAssessment').addEventListener('click', resetAssessment);

    // Add score range info
    addScoreRangeInfo();

    // Add event listeners
    addInputListeners();

    // Calculate initial score
    calculateScore();
    
    // Enable next button if data is saved
    const nextButton = document.getElementById('nextButton');
    const savedData = localStorage.getItem('projectAssessment');
    if (savedData) {
        nextButton.disabled = false;
    }
    
    // Set up risk adjustment override functionality
    console.log("Setting up override checkbox");
    const overrideCheckbox = document.getElementById('overrideRisk');
    console.log("Override checkbox:", overrideCheckbox);
    
    if (overrideCheckbox) {
        const customRiskInput = document.getElementById('customRisk');
        const overrideReason = document.getElementById('overrideReason');
        const overrideInputs = document.querySelector('.override-inputs');
        
        console.log("Override elements:", {
            checkbox: overrideCheckbox,
            input: customRiskInput,
            reason: overrideReason,
            container: overrideInputs
        });
        
        overrideCheckbox.addEventListener('change', function() {
            console.log("Checkbox changed:", this.checked);
            const isChecked = this.checked;
            
            if (overrideInputs) {
                overrideInputs.style.display = isChecked ? 'block' : 'none';
            }
            
            if (customRiskInput) {
                customRiskInput.disabled = !isChecked;
                if (isChecked) {
                    customRiskInput.value = document.getElementById('riskAdjustment').textContent.replace('%', '');
                }
            }
            
            if (overrideReason) {
                overrideReason.disabled = !isChecked;
            }
            
            if (!isChecked) {
                updateRecommendation(parseInt(document.getElementById('totalScore').textContent));
            }
        });
        
        if (customRiskInput) {
            customRiskInput.addEventListener('input', function() {
                if (this.value && !this.disabled) {
                    document.getElementById('riskAdjustment').textContent = `${this.value}%`;
                }
            });
        }
    }
});

function calculateScore() {
    let total = 0;
    document.querySelectorAll('.score-select').forEach(select => {
        total += parseInt(select.value || 1); // Default to 1 if no value
    });

    // Update both occurrences of the total score
    const totalScoreElements = document.querySelectorAll('#totalScore');
    totalScoreElements.forEach(element => {
        element.textContent = total;
    });

    updateRecommendation(total);
}

function updateRecommendation(score) {
    let approach, riskAdjustment, pmoInvolvement;

    // Don't update risk adjustment if override is active
    const overrideCheckbox = document.getElementById('overrideRisk');
    const isOverridden = overrideCheckbox && overrideCheckbox.checked;

    // Updated score ranges based on documentation
    if (score >= 21) {
        approach = "Full PMO management";
        riskAdjustment = "25%";
        pmoInvolvement = [
            "Dedicated PMO project manager assigned throughout the project lifecycle",
            "Complete project governance and steering committee facilitation",
            "Comprehensive stakeholder management and communication",
            "Detailed financial tracking and reporting",
            "Full change management and risk mitigation oversight",
            "Regular quality assurance reviews and reporting"
        ];
    } else if (score >= 17) {
        approach = "Shared management between team and PMO";
        riskAdjustment = "20%";
        pmoInvolvement = [
            "Part-time PMO resource assigned for project support",
            "Regular project governance and reporting structure",
            "Stakeholder communication support and management",
            "Proactive risk and issue management assistance",
            "Periodic quality reviews and assessments"
        ];
    } else if (score >= 13) {
        approach = "Team-led with regular PMO check-ins";
        riskAdjustment = "15%";
        pmoInvolvement = [
            "Bi-weekly check-in meetings with PMO representative",
            "Regular project health assessments",
            "Support for escalated issues and risks",
            "Resource allocation guidance",
            "Templates and tools provided for project management"
        ];
    } else {
        approach = "Team-led with minimal PMO oversight";
        riskAdjustment = "10%";
        pmoInvolvement = [
            "Access to project management templates and tools",
            "Monthly status reporting to PMO",
            "Ad-hoc consulting available on request",
            "Basic escalation path for significant issues"
        ];
    }

    // Update the display
    document.getElementById('recommendedApproach').textContent = approach;
    
    // Only update risk adjustment if not overridden
    if (!isOverridden) {
        document.getElementById('riskAdjustment').textContent = riskAdjustment;
    }

    // Update the involvement list
    const involvementList = document.getElementById('pmoInvolvement');
    involvementList.innerHTML = pmoInvolvement
        .map(item => `<li>${item}</li>`)
        .join('');
}

function validateForm() {
    // Remove bpoArea from required fields as it's no longer in the form
    const requiredFields = ['projectName', 'projectOwner', 'department', 'date', 'estimatedBy'];
    let isValid = true;
    requiredFields.forEach(field => {
        const element = document.getElementById(field);
        if (!element.value.trim()) {
            element.classList.add('invalid');
            isValid = false;
        } else {
            element.classList.remove('invalid');
        }
    });
    const overrideCheckbox = document.getElementById('overrideRisk');
if (overrideCheckbox && overrideCheckbox.checked) {
    const customRisk = document.getElementById('customRisk').value;
    const reason = document.getElementById('overrideReason').value;
    
    if (!customRisk) {
        alert('Please specify a custom risk percentage.');
        return false;
    }
    
    if (!reason.trim()) {
        alert('Please provide a reason for overriding the risk adjustment.');
        return false;
    }
}
    return isValid;
}

function saveAssessment() {
    if (!validateForm()) {
        alert('Please fill in all required fields.');
        return;
    }

    const assessment = {
        projectName: document.getElementById('projectName').value,
        projectOwner: document.getElementById('projectOwner').value,
        department: document.getElementById('department').value,
        platforms: Array.from(document.getElementById('platforms').selectedOptions).map(option => option.text),
        date: document.getElementById('date').value,
        displayDate: formatDate(document.getElementById('date').value),
        estimatedBy: document.getElementById('estimatedBy').value,
        scores: {},
        totalScore: document.getElementById('totalScore').textContent,
        recommendedApproach: document.getElementById('recommendedApproach').textContent,
        riskAdjustment: document.getElementById('riskAdjustment').textContent,
        isRiskOverridden: document.getElementById('overrideRisk').checked,
customRiskValue: document.getElementById('customRisk').value,
overrideReason: document.getElementById('overrideReason').value
    };

    document.querySelectorAll('.score-select').forEach(select => {
        assessment.scores[select.id] = select.value;
    });

    localStorage.setItem('projectAssessment', JSON.stringify(assessment));

    // Show save confirmation and enable next button
    const saveButton = document.getElementById('saveAssessment');
    const nextButton = document.getElementById('nextButton');
    
    saveButton.textContent = 'Saved!';
    saveButton.disabled = true;
    nextButton.disabled = false; // Enable next button
    
    setTimeout(() => {
        saveButton.textContent = 'Save Assessment';
        saveButton.disabled = false;
    }, 2000);

    // Add click handler for next button
    nextButton.onclick = () => window.location.href = 'costs.html';
}

function loadSavedAssessment() {
    const saved = localStorage.getItem('projectAssessment');
    if (saved) {
        const assessment = JSON.parse(saved);

        // Load all form fields with null checks
        document.getElementById('projectName').value = assessment.projectName ?? '';
        document.getElementById('projectOwner').value = assessment.projectOwner ?? '';
        document.getElementById('department').value = assessment.department ?? '';
        if (assessment.platforms) {
            const platformSelect = document.getElementById('platforms');
            Array.from(platformSelect.options).forEach(option => {
                option.selected = assessment.platforms.includes(option.text);
            });
        }
        document.getElementById('date').value = assessment.date ?? '';
        document.getElementById('estimatedBy').value = assessment.estimatedBy ?? '';

        // Load all scores with null checks
        if (assessment.scores) {
            for (const [id, value] of Object.entries(assessment.scores)) {
                const select = document.getElementById(id);
                if (select) {
                    select.value = value ?? '1'; // Default to 1 if no value
                }
            }
        }
        
        // Set up risk override UI state
        const isOverridden = assessment.isRiskOverridden || false;
        const overrideCheckbox = document.getElementById('overrideRisk');
        const customRiskInput = document.getElementById('customRisk');
        const overrideReason = document.getElementById('overrideReason');
        const overrideInputs = document.querySelector('.override-inputs');
        const riskAdjustmentDisplay = document.getElementById('riskAdjustment');
        
        if (overrideCheckbox) overrideCheckbox.checked = isOverridden;
        if (overrideInputs) overrideInputs.style.display = isOverridden ? 'block' : 'none';
        if (customRiskInput) {
            customRiskInput.disabled = !isOverridden;
            customRiskInput.value = assessment.customRiskValue || '';
        }
        if (overrideReason) {
            overrideReason.disabled = !isOverridden;
            overrideReason.value = assessment.overrideReason || '';
        }
        
        // Calculate score - but this won't override the risk adjustment now due to updateRecommendation change
        calculateScore();
        
        // Explicitly set the risk adjustment value after calculation
        if (isOverridden && riskAdjustmentDisplay) {
            riskAdjustmentDisplay.textContent = `${assessment.customRiskValue}%`;
        } else if (riskAdjustmentDisplay) {
            // If not overridden, make sure we have the stored value
            riskAdjustmentDisplay.textContent = assessment.riskAdjustment || riskAdjustmentDisplay.textContent;
        }

        console.log('Assessment loaded:', assessment); // For debugging
    } else {
        // Set default date if no saved assessment
        document.getElementById('date').valueAsDate = new Date();

        // Set default values for scores
        document.querySelectorAll('.score-select').forEach(select => {
            select.value = '1';
        });

        calculateScore();
    }
}

function resetAssessment() {
    if (confirm('Are you sure you want to reset the assessment? All data will be cleared.')) {
        document.querySelectorAll('input').forEach(input => input.value = '');
        document.querySelectorAll('.score-select').forEach(select => select.value = '1');
        document.getElementById('date').valueAsDate = new Date();
        calculateScore();
        localStorage.removeItem('projectAssessment');
    }
}

function addScoreRangeInfo() {
    const infoText = `
        <div class="score-range-info">
            <p>Score interpretation:</p>
            <ul>
                <li>21-24 points: Full PMO management (25% risk adjustment)</li>
                <li>17-20 points: Shared management between team and PMO (20% risk adjustment)</li>
                <li>13-16 points: Team-led with regular PMO check-ins (15% risk adjustment)</li>
                <li>8-12 points: Team-led with minimal PMO oversight (10% risk adjustment)</li>
            </ul>
            <p class="score-note">The total score ranges from 8 (minimum: all characteristics scored as Low) 
            to 24 (maximum: all characteristics scored as High)</p>
        </div>
    `;

    // Add this after the results section
    const resultsContainer = document.querySelector('.results-container');
    resultsContainer.insertAdjacentHTML('afterend', infoText);
}

function addInputListeners() {
    // Add listener to all score selects (existing code)
    document.querySelectorAll('.score-select').forEach(select => {
        select.addEventListener('change', calculateScore);
    });

    // Add listener to platforms select
    document.getElementById('platforms').addEventListener('change', function() {
        // If save is automatic, save the assessment
        if (document.querySelector('#platforms').value) {
            saveAssessment();
        }
    });

    // Add event listeners to buttons (existing code)
    document.getElementById('saveAssessment').addEventListener('click', saveAssessment);
    document.getElementById('resetAssessment').addEventListener('click', resetAssessment);
}

function formatDate(dateString) {
    // Convert date to DD/MM/YYYY format
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB');
}