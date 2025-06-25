import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getDatabase, ref, get, set } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// Your Firebase config object
const firebaseConfig = {
  apiKey: "AIzaSyDXXX-LMkY4Q0oN0M9e5wLdVhANzL8ifHs",
  authDomain: "fchanley-8d910.firebaseapp.com",
  databaseURL: "https://fchanley-8d910-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "fchanley-8d910",
  storageBucket: "fchanley-8d910.firebasestorage.app",
  messagingSenderId: "384977183977",
  appId: "1:384977183977:web:7805c8ba7e9122b883bc78",
  measurementId: "G-1CBV4NK83L"
};

// Initialize Firebase app and database instance
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Async function to load tournament data from Firebase
export async function getTournamentData() {
  const tournamentRef = ref(database, 'tournamentData');
  try {
    const snapshot = await get(tournamentRef);
    if (snapshot.exists()) {
      console.log("Raw tournament data from Firebase:", snapshot.val());
      return snapshot.val();
    } else {
      console.log("No tournament data found in Firebase");
      return {};
    }
  } catch (error) {
    console.error("Error loading tournament data:", error);
    return {};
  }
}

// Async function to save tournament data to Firebase
export async function saveTournamentData(data) {
  const tournamentRef = ref(database, 'tournamentData');
  try {
    await set(tournamentRef, data);
    console.log("Tournament data saved to Firebase.");
  } catch (error) {
    console.error("Error saving tournament data:", error);
  }
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
const resultForm = document.getElementById("result-form");
const resultFixtureSelect = document.getElementById("result-fixture");
const resultTeam1Score = document.getElementById("result-team1-score");
const resultTeam2Score = document.getElementById("result-team2-score");
const resultsList = document.getElementById("results-list");
const resetButton = document.getElementById("reset-tournament");

// Update team dropdowns
function updateTeamDropdowns(teams) {
  [team1Select, team2Select].forEach(select => {
    select.innerHTML = ""; // Reset dropdown
    teams.forEach(team => {
      const option = document.createElement("option");
      option.value = team;
      option.textContent = team;
      select.appendChild(option);
    });
  });
}

// Render team list
async function renderTeams(ageGroup) {
  const data = await getTournamentData();
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

//render fixtures//
async function renderFixtures(ageGroup) {
  const data = await getTournamentData();
  const fixtures = data[ageGroup]?.fixtures || [];
  const results = data[ageGroup]?.results || [];

  fixturesList.innerHTML = "";
  resultFixtureSelect.innerHTML = "";

  fixtures.forEach((fixture, index) => {
    const fixtureTime = new Date(fixture.time).getTime();

    const hasResult = results.some(result => {
      const resultTime = new Date(result.time).getTime();
      return (
        result.team1 === fixture.team1 &&
        result.team2 === fixture.team2 &&
        result.pitch === fixture.pitch &&
        resultTime === fixtureTime
      );
    });

    const formattedTime = formatTime(fixture.time) || new Date(fixture.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const li = document.createElement("li");
    li.textContent = `${formattedTime} - ${fixture.team1} vs ${fixture.team2} (Pitch ${fixture.pitch})`;

    if (hasResult) {
      // Apply strikethrough and faded styling
      li.style.textDecoration = "line-through";
      li.style.color = "#999";
    } else {
      // Only add unplayed fixtures to the dropdown
      const option = document.createElement("option");
      option.value = index;
      option.textContent = `${fixture.team1} vs ${fixture.team2} at ${formattedTime}`;
      resultFixtureSelect.appendChild(option);
    }

    fixturesList.appendChild(li);
  });
}






async function renderResults(ageGroup) {
  const data = await getTournamentData();
  resultsList.innerHTML = "";
  const results = data[ageGroup]?.results || [];

  results.forEach(result => {
    const li = document.createElement("li");

    // Use top-level properties directly (no fixture property)
    const team1 = result.team1 || "Unknown";
    const team2 = result.team2 || "Unknown";
    const score1 = result.team1Score ?? "-";
    const score2 = result.team2Score ?? "-";
    const formattedTime = formatTime(result.time);

    li.textContent = `${team1} ${score1} - ${score2} ${team2} (Time: ${formattedTime})`;
    resultsList.appendChild(li);
  });
}


// Update league table
async function updateLeagueTable(ageGroup) {
  const leagueTable = document.getElementById("league-table");
  if (!leagueTable) return;

  const data = await getTournamentData();
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
    const { fixture, team1Score, team2Score } = result;
    if (!fixture) return;
    const { team1, team2 } = fixture;
    const s1 = parseInt(team1Score);
    const s2 = parseInt(team2Score);
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
addTeamButton.addEventListener("click", async () => {
  const ageGroup = ageGroupSelect.value;
  if (!teamNameInput.value.trim()) {
    alert("Please enter a team name.");
    return;
  }
  const data = await getTournamentData();
  data[ageGroup] = data[ageGroup] || {};
  data[ageGroup].teams = data[ageGroup].teams || [];

  if (data[ageGroup].teams.includes(teamNameInput.value.trim())) {
    alert("Team already exists.");
    return;
  }

  data[ageGroup].teams.push(teamNameInput.value.trim());
  await saveTournamentData(data);

  teamNameInput.value = "";
  renderTeams(ageGroup);
  renderFixtures(ageGroup); // Refresh fixture dropdowns since teams changed
});

// Add Fixture
fixtureForm.addEventListener("submit", async e => {
  e.preventDefault();
  const ageGroup = ageGroupSelect.value;
  const team1 = team1Select.value;
  const team2 = team2Select.value;
  const time = fixtureTime.value;
  const pitch = fixturePitch.value;

  if (!team1 || !team2 || team1 === team2) {
    alert("Please select two different teams.");
    return;
  }

  if (!time) {
    alert("Please enter a fixture time.");
    return;
  }

  const data = await getTournamentData();
  data[ageGroup] = data[ageGroup] || {};
  data[ageGroup].fixtures = data[ageGroup].fixtures || [];

const [hours, minutes] = time.split(":");
const now = new Date();
const dateWithTime = new Date(
  now.getFullYear(),
  now.getMonth(),
  now.getDate(),
  parseInt(hours),
  parseInt(minutes)
);

data[ageGroup].fixtures.push({
  team1,
  team2,
  time: dateWithTime.toISOString(),
  pitch
});


  await saveTournamentData(data);
  renderFixtures(ageGroup);
  renderResults(ageGroup); // Refresh results fixture options
  fixtureForm.reset();
});

resultForm.addEventListener("submit", async e => {
  e.preventDefault();

  const ageGroup = ageGroupSelect.value;
  const fixtureIndex = resultFixtureSelect.value;
  const team1Score = resultTeam1Score.value;
  const team2Score = resultTeam2Score.value;

  if (fixtureIndex === "") {
    alert("Please select a fixture.");
    return;
  }
  if (team1Score === "" || team2Score === "") {
    alert("Please enter both scores.");
    return;
  }

  const data = await getTournamentData();
  data[ageGroup] = data[ageGroup] || {};
  data[ageGroup].results = data[ageGroup].results || [];
  data[ageGroup].fixtures = data[ageGroup].fixtures || [];

  const fixture = data[ageGroup].fixtures[fixtureIndex];
  if (!fixture) {
    alert("Invalid fixture selected.");
    return;
  }

  // Find if result exists already
  const existingResultIndex = data[ageGroup].results.findIndex(r =>
    r.team1 === fixture.team1 &&
    r.team2 === fixture.team2 &&
    r.time === fixture.time &&
    r.pitch === fixture.pitch
  );

  // Create the result object
  const newResult = {
    team1: fixture.team1,
    team2: fixture.team2,
    pitch: fixture.pitch,
    time: fixture.time,
    team1Score: parseInt(team1Score, 10),
    team2Score: parseInt(team2Score, 10)
  };

  if (existingResultIndex >= 0) {
    data[ageGroup].results[existingResultIndex] = newResult;
  } else {
    data[ageGroup].results.push(newResult);
  }

  // Save the updated results back to Firebase (or local storage)
  await saveTournamentData(data);

  // Clear form inputs
  resultForm.reset();

  // Re-render fixtures, results, and update league table
  await renderFixtures(ageGroup);
  await renderResults(ageGroup);
  updateLeagueTable(ageGroup);
});




// Reset tournament data for selected age group
resetButton.addEventListener("click", async () => {
  const ageGroup = ageGroupSelect.value;
  if (!confirm(`Are you sure you want to reset all data for ${ageGroup}?`)) return;

  const data = await getTournamentData();
  if (data[ageGroup]) {
    data[ageGroup].teams = [];
    data[ageGroup].fixtures = [];
    data[ageGroup].results = [];
    await saveTournamentData(data);
  }

  renderTeams(ageGroup);
  renderFixtures(ageGroup);
  renderResults(ageGroup);
  updateLeagueTable(ageGroup);
});

// Initial load
document.addEventListener("DOMContentLoaded", () => {
  const ageGroup = ageGroupSelect.value;
  renderTeams(ageGroup);
  renderFixtures(ageGroup);
  renderResults(ageGroup);
  updateLeagueTable(ageGroup);
});
