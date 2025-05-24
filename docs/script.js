// script.js

let tournamentData = JSON.parse(localStorage.getItem('tournamentData')) || {};
const ageGroupSelect = document.getElementById('ageGroupSelect');
const leagueTableBody = document.querySelector('#leagueTable tbody');
const fixturesList = document.getElementById('fixturesList');
const resultsList = document.getElementById('resultsList');

// Populate the UI when age group changes
ageGroupSelect.addEventListener('change', () => {
  renderPage();
});

// Main render function
function renderPage() {
  const ageGroup = ageGroupSelect.value;
  const ageGroupData = tournamentData[ageGroup] || { teams: {}, fixtures: [], results: [] };

  renderLeagueTable(ageGroupData.teams);
  renderFixtures(ageGroupData.fixtures);
  renderResults(ageGroupData.results);
}

// Render League Table
function renderLeagueTable(teams) {
  leagueTableBody.innerHTML = '';
  const teamNames = Object.keys(teams);
  if (teamNames.length === 0) {
    leagueTableBody.innerHTML = '<tr><td colspan="9">No teams added yet</td></tr>';
    return;
  }

  teamNames.forEach(teamName => {
    const team = teams[teamName];
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${teamName}</td>
      <td>${team.P}</td>
      <td>${team.W}</td>
      <td>${team.D}</td>
      <td>${team.L}</td>
      <td>${team.GF}</td>
      <td>${team.GA}</td>
      <td>${team.GD}</td>
      <td>${team.Pts}</td>
    `;
    leagueTableBody.appendChild(row);
  });
}

// Render Fixtures
function renderFixtures(fixtures) {
  fixturesList.innerHTML = '';
  const upcoming = fixtures.filter(f => !f.played);
  if (upcoming.length === 0) {
    fixturesList.innerHTML = '<li>No upcoming fixtures</li>';
    return;
  }

  upcoming.forEach(fixture => {
    const li = document.createElement('li');
    li.textContent = `${fixture.time} - ${fixture.homeTeam} vs ${fixture.awayTeam}`;
    fixturesList.appendChild(li);
  });
}

// Render Results
function renderResults(results) {
  resultsList.innerHTML = '';
  if (results.length === 0) {
    resultsList.innerHTML = '<li>No results entered</li>';
    return;
  }

  results.forEach(result => {
    const li = document.createElement('li');
    li.textContent = `${result.time} - ${result.homeTeam} ${result.homeScore} - ${result.awayScore} ${result.awayTeam}`;
    resultsList.appendChild(li);
  });
}

// Load initial data
renderPage();

window.onload = function () {
  const morningAgeGroups = ['u7', 'u8'];  // U7 and U8 in the morning
  const afternoonAgeGroups = ['u9', 'u10'];  // U9 and U10 in the afternoon

  let isMorning = true;  // Default to morning view

  // Function to hide all age groups
  function hideAllAgeGroups() {
    const ageGroupSections = document.querySelectorAll('.age-group-section');
    ageGroupSections.forEach(section => {
      section.style.display = 'none';
    });
  }

  // Function to show specific age groups
  function showAgeGroups(groups) {
    groups.forEach(group => {
      const groupSection = document.getElementById(`${group}-home`);
      if (groupSection) {
        groupSection.style.display = 'block';  // Show the selected age group
      }
    });
  }

};
