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
const daySelect = document.getElementById("day-select");
const sessionSelect = document.getElementById("session-select");
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

const knockoutFixtureSelect = document.getElementById("knockout-fixture");
const knockoutTeam1Score = document.getElementById("knockout-team1-score");
const knockoutTeam2Score = document.getElementById("knockout-team2-score");
const addKnockoutResultButton = document.getElementById("add-knockout-result");
const knockoutResultsList = document.getElementById("knockout-results-list");

const resetButton = document.getElementById("reset-tournament");

const moveFixtureForm = document.getElementById("move-fixture-form");
const moveFixtureSelect = document.getElementById("move-fixture-select");
const newFixtureTimeInput = document.getElementById("new-fixture-time");

function getSelectedTournamentPath() {
  const day = daySelect.value;
  const session = sessionSelect.value;
  const ageGroup = ageGroupSelect.value;

  return {
    day,
    session,
    ageGroup,
    path: `${day}/${session}/${ageGroup}`
  };
}

function ensureSelectedTournamentData(data) {
  const { day, session, ageGroup } = getSelectedTournamentPath();

  data[day] = data[day] || {};
  data[day][session] = data[day][session] || {};
  data[day][session][ageGroup] = data[day][session][ageGroup] || {};

  data[day][session][ageGroup].teams =
    data[day][session][ageGroup].teams || [];

  data[day][session][ageGroup].fixtures =
    data[day][session][ageGroup].fixtures || [];

  data[day][session][ageGroup].results =
    data[day][session][ageGroup].results || [];

  return data[day][session][ageGroup];
}


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
async function renderTeams() {
  const data = await getTournamentData();

  const { day, session, ageGroup } = getSelectedTournamentPath();

  const teams =
    data[day]?.[session]?.[ageGroup]?.teams ||
    data[ageGroup]?.teams ||
    [];

  teamsList.innerHTML = "";

  teams.forEach(team => {
    const li = document.createElement("li");
    li.textContent = team;
    teamsList.appendChild(li);
  });

  updateTeamDropdowns(teams);
}

function calculateStandingsForFixtures(fixtures, results) {
  const table = {};

  fixtures.forEach(fixture => {
    if (!table[fixture.team1]) {
      table[fixture.team1] = {
        team: fixture.team1,
        played: 0,
        points: 0,
        gf: 0,
        ga: 0,
        gd: 0
      };
    }

    if (!table[fixture.team2]) {
      table[fixture.team2] = {
        team: fixture.team2,
        played: 0,
        points: 0,
        gf: 0,
        ga: 0,
        gd: 0
      };
    }
  });

  results.forEach(result => {
    const matchingFixture = fixtures.find(fixture =>
      fixture.team1 === result.team1 &&
      fixture.team2 === result.team2 &&
      fixture.time === result.time &&
      fixture.pitch === result.pitch
    );

    if (!matchingFixture) return;

    const team1 = result.team1;
    const team2 = result.team2;
    const s1 = parseInt(result.team1Score, 10);
    const s2 = parseInt(result.team2Score, 10);

    if (isNaN(s1) || isNaN(s2)) return;

    table[team1].played++;
    table[team2].played++;

    table[team1].gf += s1;
    table[team1].ga += s2;
    table[team2].gf += s2;
    table[team2].ga += s1;

    if (s1 > s2) {
      table[team1].points += 3;
    } else if (s2 > s1) {
      table[team2].points += 3;
    } else {
      table[team1].points += 1;
      table[team2].points += 1;
    }

    table[team1].gd = table[team1].gf - table[team1].ga;
    table[team2].gd = table[team2].gf - table[team2].ga;
  });

  return Object.values(table).sort((a, b) =>
    b.points !== a.points
      ? b.points - a.points
      : b.gd !== a.gd
      ? b.gd - a.gd
      : b.gf - a.gf
  );
}

function getKnockoutFixtures(fixtures, results) {
  const groupAFixtures = fixtures.filter(fixture => fixture.group === "Group A");
  const groupBFixtures = fixtures.filter(fixture => fixture.group === "Group B");

  if (groupAFixtures.length === 0 || groupBFixtures.length === 0) {
    return [];
  }

  const allGroupFixturesHaveResults = fixtures.every(fixture =>
    results.some(result =>
      result.team1 === fixture.team1 &&
      result.team2 === fixture.team2 &&
      result.time === fixture.time &&
      result.pitch === fixture.pitch
    )
  );

  if (!allGroupFixturesHaveResults) {
    return [];
  }

  const groupAStandings = calculateStandingsForFixtures(groupAFixtures, results);
  const groupBStandings = calculateStandingsForFixtures(groupBFixtures, results);

  if (groupAStandings.length < 2 || groupBStandings.length < 2) {
    return [];
  }

  const semiFinals = [
    {
      stage: "Semi Final 1",
      team1: groupAStandings[0].team,
      team2: groupBStandings[1].team
    },
    {
      stage: "Semi Final 2",
      team1: groupBStandings[0].team,
      team2: groupAStandings[1].team
    }
  ];

  const semiFinalResults = results.filter(result =>
    result.type === "knockout" &&
    (result.stage === "Semi Final 1" || result.stage === "Semi Final 2")
  );

  if (semiFinalResults.length < 2) {
    return semiFinals;
  }

  const semiFinal1Result = semiFinalResults.find(result => result.stage === "Semi Final 1");
  const semiFinal2Result = semiFinalResults.find(result => result.stage === "Semi Final 2");

  if (!semiFinal1Result || !semiFinal2Result) {
    return semiFinals;
  }

  const semiFinal1Winner =
    semiFinal1Result.team1Score > semiFinal1Result.team2Score
      ? semiFinal1Result.team1
      : semiFinal1Result.team2;

  const semiFinal2Winner =
    semiFinal2Result.team1Score > semiFinal2Result.team2Score
      ? semiFinal2Result.team1
      : semiFinal2Result.team2;

  const finalFixture = {
    stage: "Final",
    team1: semiFinal1Winner,
    team2: semiFinal2Winner
  };

  return [...semiFinals, finalFixture];
}

// Helper to format ISO datetime string to local time string (e.g., "8:20 AM")
function formatTime(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// render fixtures
async function renderFixtures(ageGroup) {
  const data = await getTournamentData();

  const { day, session } = getSelectedTournamentPath();

  const fixtures =
    data[day]?.[session]?.[ageGroup]?.fixtures ||
    data[ageGroup]?.fixtures ||
    [];

  const results =
    data[day]?.[session]?.[ageGroup]?.results ||
    data[ageGroup]?.results ||
    [];

  fixtures.sort((a, b) => new Date(a.time) - new Date(b.time));

  console.log(
    "Sorted fixtures:",
    fixtures.map(f => `${f.time} | ${f.team1} vs ${f.team2}`)
  );

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

    const formattedTime =
      formatTime(fixture.time) ||
      new Date(fixture.time).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      });

    const li = document.createElement("li");
    li.textContent = `${formattedTime} - ${fixture.team1} vs ${fixture.team2} (Pitch ${fixture.pitch})`;

    if (hasResult) {
      li.style.textDecoration = "line-through";
      li.style.color = "#999";
    } else {
      const option = document.createElement("option");
      option.value = index;
      option.textContent = `${fixture.team1} vs ${fixture.team2} at ${formattedTime}`;
      resultFixtureSelect.appendChild(option);
    }

    fixturesList.appendChild(li);
  });


  // 👇 ADD THIS HERE (before closing })
  const knockoutFixtures = getKnockoutFixtures(fixtures, results);

  knockoutFixtureSelect.innerHTML = '<option value="">Select knockout fixture</option>';

  knockoutFixtures.forEach((fixture, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = `${fixture.stage}: ${fixture.team1} vs ${fixture.team2}`;
    knockoutFixtureSelect.appendChild(option);
  });
}

// render Results
async function renderResults() {
  const data = await getTournamentData();

  resultsList.innerHTML = "";

  const { day, session, ageGroup } = getSelectedTournamentPath();

  const results =
    data[day]?.[session]?.[ageGroup]?.results ||
    data[ageGroup]?.results ||
    [];

  results.forEach(result => {
    const li = document.createElement("li");

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

  const { day, session } = getSelectedTournamentPath();

  const teams =
    data[day]?.[session]?.[ageGroup]?.teams ||
    data[ageGroup]?.teams ||
    [];

  const results =
    data[day]?.[session]?.[ageGroup]?.results ||
    data[ageGroup]?.results ||
    [];

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
    const team1 = result.team1 || result.fixture?.team1;
    const team2 = result.team2 || result.fixture?.team2;

    const s1 = parseInt(result.team1Score, 10);
    const s2 = parseInt(result.team2Score, 10);

    if (!team1 || !team2) return;
    if (!table[team1] || !table[team2]) return;
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
[daySelect, sessionSelect, ageGroupSelect].forEach(el => {
  el.addEventListener("change", () => {
    const day = daySelect.value;
    const session = sessionSelect.value;
    const ageGroup = ageGroupSelect.value;
    renderTeams(ageGroup);
    renderFixtures(ageGroup);
    renderResults(ageGroup);
    updateLeagueTable(ageGroup);
  });
});


// Add Team
addTeamButton.addEventListener("click", async () => {
  if (!teamNameInput.value.trim()) {
    alert("Please enter a team name.");
    return;
  }

  const data = await getTournamentData();
  const groupData = ensureSelectedTournamentData(data);
  const newTeam = teamNameInput.value.trim();

  if (groupData.teams.includes(newTeam)) {
    alert("Team already exists.");
    return;
  }

  groupData.teams.push(newTeam);
  await saveTournamentData(data);
  teamNameInput.value = "";

  renderTeams();
  renderFixtures();
});

// Add Fixture
// Add Fixture
fixtureForm.addEventListener("submit", async e => {
  e.preventDefault();

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
  const groupData = ensureSelectedTournamentData(data);

  const [hours, minutes] = time.split(":");
  const now = new Date();

  const dateWithTime = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    parseInt(hours, 10),
    parseInt(minutes, 10)
  );

  groupData.fixtures.push({
    team1,
    team2,
    time: dateWithTime.toISOString(),
    pitch
  });

  groupData.fixtures.sort((a, b) => new Date(a.time) - new Date(b.time));

  await saveTournamentData(data);

  renderFixtures();
  renderResults();
  fixtureForm.reset();
});

// Add Result
resultForm.addEventListener("submit", async e => {
  e.preventDefault();

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
  const groupData = ensureSelectedTournamentData(data);

  const fixture = groupData.fixtures[fixtureIndex];
  if (!fixture) {
    alert("Invalid fixture selected.");
    return;
  }

  const existingResultIndex = groupData.results.findIndex(r =>
    r.team1 === fixture.team1 &&
    r.team2 === fixture.team2 &&
    r.time === fixture.time &&
    r.pitch === fixture.pitch
  );

const newResult = {
  team1: fixture.team1,
  team2: fixture.team2,
  pitch: fixture.pitch,
  time: fixture.time,
  group: fixture.group || "",
  team1Score: parseInt(team1Score, 10),
  team2Score: parseInt(team2Score, 10)
};

  if (existingResultIndex >= 0) {
    groupData.results[existingResultIndex] = newResult;
  } else {
    groupData.results.push(newResult);
  }

await saveTournamentData(data);

resultTeam1Score.value = "";
resultTeam2Score.value = "";

const currentAgeGroup = ageGroupSelect.value;

await renderFixtures(currentAgeGroup);
await renderResults(currentAgeGroup);
await updateLeagueTable(currentAgeGroup);
});

// Add Knockout Result
addKnockoutResultButton.addEventListener("click", async () => {
  const selectedIndex = knockoutFixtureSelect.value;
  const team1Score = knockoutTeam1Score.value;
  const team2Score = knockoutTeam2Score.value;

  if (selectedIndex === "") {
    alert("Please select a knockout fixture.");
    return;
  }

  if (team1Score === "" || team2Score === "") {
    alert("Please enter both scores.");
    return;
  }

  const data = await getTournamentData();
  const groupData = ensureSelectedTournamentData(data);

  const knockoutFixtures = getKnockoutFixtures(
    groupData.fixtures || [],
    groupData.results || []
  );

  const fixture = knockoutFixtures[selectedIndex];

  if (!fixture) {
    alert("Invalid knockout fixture selected.");
    return;
  }

  const newResult = {
    stage: fixture.stage,
    team1: fixture.team1,
    team2: fixture.team2,
    team1Score: parseInt(team1Score, 10),
    team2Score: parseInt(team2Score, 10),
    type: "knockout"
  };

  const existingResultIndex = groupData.results.findIndex(result =>
    result.type === "knockout" &&
    result.stage === fixture.stage
  );

  if (existingResultIndex >= 0) {
    groupData.results[existingResultIndex] = newResult;
  } else {
    groupData.results.push(newResult);
  }

  await saveTournamentData(data);

  knockoutTeam1Score.value = "";
  knockoutTeam2Score.value = "";

  await renderFixtures(ageGroupSelect.value);
  await renderResults(ageGroupSelect.value);

  alert(`${fixture.stage} result saved.`);
});

// Reset tournament data for selected day/session/age group
resetButton.addEventListener("click", async () => {
  const day = daySelect.value;
  const session = sessionSelect.value;
  const ageGroup = ageGroupSelect.value;

  if (!confirm(`Are you sure you want to reset all data for ${day} / ${session} / ${ageGroup}?`)) return;

  const data = await getTournamentData();

  if (data[day]?.[session]?.[ageGroup]) {
    data[day][session][ageGroup].teams = [];
    data[day][session][ageGroup].fixtures = [];
    data[day][session][ageGroup].results = [];

    await saveTournamentData(data);
  }

  await renderTeams(ageGroup);
  await renderFixtures(ageGroup);
  await renderResults(ageGroup);
  await updateLeagueTable(ageGroup);

  alert(`Tournament data reset for ${day} / ${session} / ${ageGroup}.`);
});

// Initial load
document.addEventListener("DOMContentLoaded", () => {
  const ageGroup = ageGroupSelect.value;
  renderTeams(ageGroup);
  renderFixtures(ageGroup);
  renderResults(ageGroup);
  updateLeagueTable(ageGroup);
});
