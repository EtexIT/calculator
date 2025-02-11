// Add this to your existing JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Export functionality
    document.getElementById('exportProject').addEventListener('click', exportProjectData);
    
    // Import functionality
    document.getElementById('importProject').addEventListener('change', importProjectData);
});

function exportProjectData() {
    try {
        // Collect all project data
        const projectData = {
            assessment: JSON.parse(localStorage.getItem('projectAssessment') || '{}'),
            costs: JSON.parse(localStorage.getItem('projectCosts') || '{}'),
            value: JSON.parse(localStorage.getItem('projectValue') || '{}'),
            exportDate: new Date().toISOString(),
            version: '1.0'
        };

        // Validate that we have some data
        if (!projectData.assessment.projectName) {
            showStatus('Please complete the project assessment first.', 'error');
            return;
        }

        // Create the file
        const dataStr = JSON.stringify(projectData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        
        // Generate filename using project name
        const filename = `${projectData.assessment.projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.json`;

        // Create download link and trigger it
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        showStatus('Project exported successfully!', 'success');
    } catch (error) {
        console.error('Export error:', error);
        showStatus('Error exporting project data. Please try again.', 'error');
    }
}

function importProjectData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const projectData = JSON.parse(e.target.result);

            // Validate the data structure
            if (!projectData.version || !projectData.assessment) {
                throw new Error('Invalid project file format');
            }

            // Confirm before overwriting
            if (localStorage.getItem('projectAssessment')) {
                if (!confirm('This will overwrite your current project data. Continue?')) {
                    event.target.value = ''; // Reset file input
                    return;
                }
            }

            // Store the imported data
            if (projectData.assessment) localStorage.setItem('projectAssessment', JSON.stringify(projectData.assessment));
            if (projectData.costs) localStorage.setItem('projectCosts', JSON.stringify(projectData.costs));
            if (projectData.value) localStorage.setItem('projectValue', JSON.stringify(projectData.value));

            showStatus('Project imported successfully! Refreshing page...', 'success');
            
            // Refresh the page after a short delay
            setTimeout(() => window.location.reload(), 1500);

        } catch (error) {
            console.error('Import error:', error);
            showStatus('Error importing project data. Please check the file format.', 'error');
        }
    };

    reader.readAsText(file);
}

function showStatus(message, type = 'success') {
    const statusDiv = document.getElementById('shareStatus');
    const color = type === 'success' ? '#22c55e' : '#ef4444';
    
    statusDiv.innerHTML = `
        <div style="padding: 0.75rem; border-radius: 4px; background-color: ${color}15; color: ${color}; margin-top: 1rem;">
            ${message}
        </div>
    `;

    // Clear status after 5 seconds
    setTimeout(() => {
        statusDiv.innerHTML = '';
    }, 5000);
}