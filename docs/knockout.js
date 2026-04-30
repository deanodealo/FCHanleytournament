// Function to populate the knockout stage fields
async function populateKnockoutStage() {
    // Assuming tournamentData is accessible here
    const tournamentData = await getTournamentData(); // Function to fetch tournament data
    const ageGroups = ['U7', 'U8', 'U9', 'U10']; // Add other age groups as necessary

    ageGroups.forEach(ageGroup => {
        const teams = tournamentData[ageGroup]?.teams || [];
        if (teams.length >= 4) {
            // Get top 4 teams
            const topTeams = teams.slice(0, 4);
            // Populate semi-final matches
            document.getElementById('match1').value = `${topTeams[0]} vs ${topTeams[3]}`;
            document.getElementById('match2').value = `${topTeams[1]} vs ${topTeams[2]}`;
        }
    });
}

// Call the function when the page loads
window.onload = populateKnockoutStage;
