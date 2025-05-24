// Shared functions for loading/saving data
function getTournamentData() {
  return JSON.parse(localStorage.getItem("tournamentData")) || {};
}

function saveTournamentData(data) {
  localStorage.setItem("tournamentData", JSON.stringify(data));
}

// DOM elements
const ageGroupSelect = document.getElementById("age-group-select");
const teamNameInput = document.getElementById("team-name");
const addTeamButton = document.getElementById("add-team");
const teamsList = document.getElementById("teams-list");
const team1Select = document.getElementById("team1");
const team2Select = document.getElementById("team2");
const fixtureForm = document.getElementById("fixture-form");
const fixtureTime = document.getElementById("fixture-time");
const fixturePitch = document.getElementById("fixture-pitch");
const fixturesList = document.getElementById("fixtures-list");
console.log("fixturesList element:", fixturesList);
const resultForm = document.getElementById("result-form");
const resultFixtureSelect = document.getElementById("result-fixture");
const resultTeam1Score = document.getElementById("result-team1-score");
const resultTeam2Score = document.getElementById("result-team2-score");
const resultsList = document.getElementById("results-list");
const resetButton = document.getElementById("reset-tournament");


// Update team dropdowns
function updateTeamDropdowns(teams) {
  [team1Select, team2Select].forEach(select => {
    select.innerHTML = ""; // Reset the dropdown
    teams.forEach(team => {
      const option = document.createElement("option");
      option.value = team;
      option.textContent = team;
      select.appendChild(option);
    });
  });
}

// Render team list
function renderTeams(ageGroup) {
  const data = getTournamentData();
  const teams = data[ageGroup]?.teams || [];
  teamsList.innerHTML = "";
  teams.forEach(team => {
    const li = document.createElement("li");
    li.textContent = team;
    teamsList.appendChild(li);
  });
  updateTeamDropdowns(teams);
}

// Helper to format ISO datetime string to local time string (e.g., "8:20 AM")
function formatTime(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Render fixtures
function renderFixtures(ageGroup) {
  const data = getTournamentData();
  const fixtures = data[ageGroup]?.fixtures || [];
  fixturesList.innerHTML = "";
  resultFixtureSelect.innerHTML = ""; // Clear previous options

  fixtures.forEach((fixture, index) => {
    const formattedTime = formatTime(fixture.time);

    const li = document.createElement("li");
    li.textContent = `${formattedTime} - ${fixture.team1} vs ${fixture.team2} (Pitch ${fixture.pitch})`;
    fixturesList.appendChild(li);

    const option = document.createElement("option");
    option.value = index;
    option.textContent = `${fixture.team1} vs ${fixture.team2} at ${formattedTime}`;
    resultFixtureSelect.appendChild(option);
  });
}

function renderResults(ageGroup) {
  const data = getTournamentData();
  resultsList.innerHTML = "";

  const results = data[ageGroup]?.results || [];

  results.forEach(result => {
    const li = document.createElement("li");

    // Safely access nested fixture data
    const team1 = result.fixture?.team1 || "Unknown";
    const team2 = result.fixture?.team2 || "Unknown";
    const score1 = result.team1Score ?? "-";
    const score2 = result.team2Score ?? "-";
    const formattedTime = formatTime(result.fixture?.time);

    li.textContent = `${team1} ${score1} - ${score2} ${team2} (Time: ${formattedTime})`;
    resultsList.appendChild(li);
  });
}


// Update league table (only if table exists — e.g. on Home Page)
function updateLeagueTable(ageGroup) {
  const matchResults = document.getElementById("match-results");
  const leagueTable = document.getElementById("league-table");
  if (!matchResults || !leagueTable) return;

  const data = getTournamentData();
  const teams = data[ageGroup]?.teams || [];
  const results = data[ageGroup]?.results || [];

  const table = {};
  teams.forEach(team => {
    table[team] = {
      team,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      points: 0
    };
  });

  results.forEach(result => {
    const { team1, team2, score1, score2 } = result;
    const s1 = parseInt(score1);
    const s2 = parseInt(score2);
    if (isNaN(s1) || isNaN(s2)) return;

    table[team1].played++;
    table[team2].played++;
    table[team1].gf += s1;
    table[team1].ga += s2;
    table[team2].gf += s2;
    table[team2].ga += s1;

    if (s1 > s2) {
      table[team1].won++;
      table[team2].lost++;
      table[team1].points += 3;
    } else if (s2 > s1) {
      table[team2].won++;
      table[team1].lost++;
      table[team2].points += 3;
    } else {
      table[team1].drawn++;
      table[team2].drawn++;
      table[team1].points += 1;
      table[team2].points += 1;
    }

    table[team1].gd = table[team1].gf - table[team1].ga;
    table[team2].gd = table[team2].gf - table[team2].ga;
  });

  const standings = Object.values(table).sort((a, b) =>
    b.points !== a.points
      ? b.points - a.points
      : b.gd !== a.gd
      ? b.gd - a.gd
      : b.gf - a.gf
  );

  leagueTable.innerHTML = `
    <tr>
      <th>Team</th>
      <th>Pl</th>
      <th>W</th>
      <th>D</th>
      <th>L</th>
      <th>GF</th>
      <th>GA</th>
      <th>GD</th>
      <th>Pts</th>
    </tr>
  `;

  standings.forEach(team => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${team.team}</td>
      <td>${team.played}</td>
      <td>${team.won}</td>
      <td>${team.drawn}</td>
      <td>${team.lost}</td>
      <td>${team.gf}</td>
      <td>${team.ga}</td>
      <td>${team.gd}</td>
      <td>${team.points}</td>
    `;
    leagueTable.appendChild(row);
  });
}

// Load data when age group changes
ageGroupSelect.addEventListener("change", () => {
  const ageGroup = ageGroupSelect.value;
  renderTeams(ageGroup);
  renderFixtures(ageGroup);
  renderResults(ageGroup);
  updateLeagueTable(ageGroup);
});

// Add Team
addTeamButton.addEventListener("click", () => {
  const ageGroup = ageGroupSelect.value;
  const teamName = teamNameInput.value.trim();
  if (teamName === "") return;

  const data = getTournamentData();
  data[ageGroup] = data[ageGroup] || { teams: [], fixtures: [], results: [] };
  if (!data[ageGroup].teams.includes(teamName)) {
    data[ageGroup].teams.push(teamName);
    saveTournamentData(data);
    renderTeams(ageGroup);
    teamNameInput.value = "";
  }
});

// Add Fixture
fixtureForm.addEventListener("submit", e => {
  e.preventDefault();
  const ageGroup = ageGroupSelect.value;
  const team1 = team1Select.value;
  const team2 = team2Select.value;
  const time = fixtureTime.value;
  const pitch = fixturePitch.value;
  if (team1 === team2 || !team1 || !team2) return;

  const data = getTournamentData();
  data[ageGroup] = data[ageGroup] || { teams: [], fixtures: [], results: [] };
  data[ageGroup].fixtures.push({ team1, team2, time, pitch });
  saveTournamentData(data);
  renderFixtures(ageGroup);
  fixtureForm.reset();
});

resultForm.addEventListener("submit", e => {
  e.preventDefault();

  const ageGroup = ageGroupSelect.value;
  const fixtureIndex = resultFixtureSelect.value;
  const data = getTournamentData();

  const fixture = data[ageGroup]?.fixtures?.[fixtureIndex];
  if (!fixture) return;

  const score1 = resultTeam1Score.value;
  const score2 = resultTeam2Score.value;
  if (score1 === "" || score2 === "") return;

  // Ensure the age group exists
  data[ageGroup] = data[ageGroup] || { teams: [], fixtures: [], results: [] };

  // Push result with fixture nested inside
  data[ageGroup].results.push({
    fixture: {
      team1: fixture.team1,
      team2: fixture.team2,
      time: fixture.time,
      pitch: fixture.pitch
    },
    team1Score: parseInt(score1),
    team2Score: parseInt(score2)
  });

  // Remove the fixture from the list now that it's played
  data[ageGroup].fixtures.splice(fixtureIndex, 1);

  // Save and update
  saveTournamentData(data);
  renderResults(ageGroup);
  renderFixtures(ageGroup);  // Add this if it's not already being called
  updateLeagueTable(ageGroup);
  resultForm.reset();
});

// Reset tournament
resetButton.addEventListener("click", () => {
  const ageGroup = ageGroupSelect.value;
  const data = getTournamentData();
  if (confirm(`Are you sure you want to reset data for ${ageGroup}?`)) {
    delete data[ageGroup];
    saveTournamentData(data);
    renderTeams(ageGroup);
    renderFixtures(ageGroup);
    renderResults(ageGroup);
    updateLeagueTable(ageGroup);
  }
});

// Initial load
document.addEventListener("DOMContentLoaded", () => {
  const ageGroup = ageGroupSelect.value;
  renderTeams(ageGroup);
  renderFixtures(ageGroup);
  renderResults(ageGroup);
  updateLeagueTable(ageGroup);
});

// =====================
// Edit Result Module
// =====================

function populateEditResultDropdown(ageGroup) {
  const data = JSON.parse(localStorage.getItem("tournamentData")) || {};
  const results = data[ageGroup]?.results || [];
  const fixtures = data[ageGroup]?.fixtures || [];

  //const select = document.getElementById("edit-result-select");
  //select.innerHTML = "";

  results.forEach((result, index) => {
    const fixture = fixtures.find(f => f.id === result.fixtureId);
    if (!fixture) return;

    const option = document.createElement("option");
    option.value = result.fixtureId;
    option.textContent = `${fixture.time} – ${fixture.team1} vs ${fixture.team2} (${result.team1Score}-${result.team2Score})`;
    select.appendChild(option);
  });

  if (results.length > 0) {
    select.dispatchEvent(new Event("change")); // Pre-fill on load
  }
}

document.getElementById('age-group-select').addEventListener('change', function() {
  const ageGroup = this.value;
  displayFixturesForAgeGroup(ageGroup);
});

function displayFixturesForAgeGroup(ageGroup) {
  const allFixtures = JSON.parse(localStorage.getItem('fixturesByAgeGroup')) || {};
  const fixtures = allFixtures[ageGroup] || [];

  const fixtureDisplay = document.getElementById('fixture-display');
  if (fixtures.length === 0) {
    fixtureDisplay.innerHTML = 'No fixtures found for ' + ageGroup;
    return;
  }

  // Create a simple list of fixtures
  const listItems = fixtures.map(f => {
    return `<li>${f.home} vs ${f.away} at ${f.time}</li>`;
  }).join('');

  fixtureDisplay.innerHTML = `<ul>${listItems}</ul>`;
}

// Optionally load fixtures for the default selected age group on page load
window.addEventListener('load', () => {
  const defaultAgeGroup = document.getElementById('age-group-select').value;
  displayFixturesForAgeGroup(defaultAgeGroup);
});
