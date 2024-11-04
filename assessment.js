const ASSESSMENT_THRESHOLDS = {
    FULL_PMO: 21,         // Was 25
    SHARED_MANAGEMENT: 17, // Was 20
    TEAM_LED_CHECKINS: 13 // Was 14
};

const RISK_ADJUSTMENTS = {
    HIGH: 25,          // For scores 21-24
    MEDIUM_HIGH: 20,   // For scores 17-20
    MEDIUM: 15,        // For scores 13-16
    LOW: 10           // For scores 8-12
};

// Main initialization
document.addEventListener('DOMContentLoaded', function() {
    initializeAssessment();
});

function initializeAssessment() {
    const form = document.getElementById('assessmentForm');
    if (!form) return;
    
    // Add change event listener to all selects
    form.querySelectorAll('select').forEach(select => {
        select.addEventListener('change', updateAssessment);
    });

    // Load saved assessment if available
    loadSavedAssessment();
}

function updateAssessment() {
    const totalScore = calculateTotalScore();
    const { managementApproach, riskAdjustment } = determineProjectCharacteristics(totalScore);
    
    updateDisplay(totalScore, managementApproach, riskAdjustment);
    saveAssessment(totalScore, riskAdjustment);
}

function calculateTotalScore() {
    const form = document.getElementById('assessmentForm');
    if (!form) return 8; // default minimum score
    
    let total = 0;
    form.querySelectorAll('select').forEach(select => {
        total += parseInt(select.value) || 0;
    });
    
    return total;
}

function determineProjectCharacteristics(totalScore) {
    let managementApproach;
    let riskAdjustment;

    if (totalScore >= ASSESSMENT_THRESHOLDS.FULL_PMO) {
        managementApproach = 'Full PMO management';
        riskAdjustment = RISK_ADJUSTMENTS.HIGH;
    } else if (totalScore >= ASSESSMENT_THRESHOLDS.SHARED_MANAGEMENT) {
        managementApproach = 'Shared management between team and PMO';
        riskAdjustment = RISK_ADJUSTMENTS.MEDIUM_HIGH;
    } else if (totalScore >= ASSESSMENT_THRESHOLDS.TEAM_LED_CHECKINS) {
        managementApproach = 'Team-led with regular PMO check-ins';
        riskAdjustment = RISK_ADJUSTMENTS.MEDIUM;
    } else {
        managementApproach = 'Team-led with minimal PMO oversight';
        riskAdjustment = RISK_ADJUSTMENTS.LOW;
    }

    return { managementApproach, riskAdjustment };
}

function updateDisplay(totalScore, managementApproach, riskAdjustment) {
    const totalScoreElement = document.getElementById('totalScore');
    const managementApproachElement = document.getElementById('managementApproach');
    const riskAdjustmentElement = document.getElementById('riskAdjustment');

    if (totalScoreElement) totalScoreElement.textContent = totalScore;
    if (managementApproachElement) managementApproachElement.textContent = managementApproach;
    if (riskAdjustmentElement) riskAdjustmentElement.textContent = riskAdjustment;

    // Trigger storage event to update cost calculator if it's open
    window.localStorage.setItem('projectAssessment', JSON.stringify({
        scores: collectFormScores(),
        totalScore: totalScore,
        riskAdjustment: riskAdjustment
    }));
}

function collectFormScores() {
    const scores = {};
    const form = document.getElementById('assessmentForm');
    if (form) {
        form.querySelectorAll('select').forEach(select => {
            scores[select.name] = select.value;
        });
    }
    return scores;
}

function loadSavedAssessment() {
    const saved = localStorage.getItem('projectAssessment');
    if (saved) {
        const assessment = JSON.parse(saved);
        const form = document.getElementById('assessmentForm');
        
        if (form && assessment.scores) {
            Object.entries(assessment.scores).forEach(([name, value]) => {
                const select = form.querySelector(`select[name="${name}"]`);
                if (select) select.value = value;
            });
        }
        
        // Update display with saved values
        updateAssessment();
    }
}