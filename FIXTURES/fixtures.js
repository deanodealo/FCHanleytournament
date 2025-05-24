let scheduledFixtures = []; // store for export
function generateFixtures() {
  const ageGroup = document.getElementById("ageGroup").value;  
  const pitches = parseInt(document.getElementById("pitches").value);
  const gameLength = parseInt(document.getElementById("matchLength").value);
  const gamesPerTeam = parseInt(document.getElementById("gamesPerTeam").value);
  const enableBreaks = document.getElementById("enableBreaks").checked;
  const breakLength = parseInt(document.getElementById("breakLength").value) || 0;

  const teamNamesRaw = document.getElementById("teamNames").value.trim();
  if (!teamNamesRaw) {
    alert("Please enter team names.");
    return;
  }
  const teams = teamNamesRaw.split("\n").map(t => t.trim()).filter(t => t);

  if (teams.length < 2) {
    alert("Please enter at least 2 teams.");
    return;
  }
  if (gamesPerTeam > teams.length - 1) {
    alert("Games per team cannot exceed number of opponents (teams - 1).");
    return;
  }

  // Generate fixtures using round-robin partial schedule
  const fixtures = generateMatchups(teams, gamesPerTeam);
  if (fixtures.length === 0) return;

  // Schedule match times
  const scheduledFixtures = scheduleMatchTimes(fixtures, pitches, gameLength, enableBreaks, breakLength);

  // Load existing tournamentData or create
  const tournamentData = JSON.parse(localStorage.getItem("tournamentData")) || {};
  if (!tournamentData[ageGroup]) {
    tournamentData[ageGroup] = { teams: [], fixtures: [], results: [] };
  }

  // Save teams and fixtures under ageGroup
  tournamentData[ageGroup].teams = teams;
  tournamentData[ageGroup].fixtures = scheduledFixtures;

  // Save back to localStorage
  localStorage.setItem("tournamentData", JSON.stringify(tournamentData));

  alert(`Fixtures generated and saved for age group ${ageGroup}.`);

  // Update UI
  displayFixtures(scheduledFixtures);
  displayTeamMatchLists(scheduledFixtures, teams);
}



/**
 * Round-robin partial schedule generator
 * Each team plays gamesPerTeam matches without repeats
 */
function generateMatchups(teams, gamesPerTeam) {
  const n = teams.length;
  if (gamesPerTeam > n - 1) {
    alert("Games per team cannot exceed number of opponents (teams - 1).");
    return [];
  }

  // Add dummy team if odd number for bye rounds
  const isOdd = n % 2 !== 0;
  const teamList = isOdd ? [...teams, "BYE"] : [...teams];
  const totalTeams = teamList.length;

  const rounds = [];

  // Number of rounds needed (limit by gamesPerTeam)
  const roundsCount = Math.min(gamesPerTeam, totalTeams - 1);

  // Round-robin scheduling using circle method
  for (let round = 0; round < roundsCount; round++) {
    for (let i = 0; i < totalTeams / 2; i++) {
      const home = teamList[i];
      const away = teamList[totalTeams - 1 - i];
      if (home !== "BYE" && away !== "BYE") {
        rounds.push([home, away]);
      }
    }
    // Rotate teams except first one
    teamList.splice(1, 0, teamList.pop());
  }

  // Check each team has exactly gamesPerTeam matches
  const gamesCount = {};
  teams.forEach(t => gamesCount[t] = 0);
  rounds.forEach(([t1, t2]) => {
    gamesCount[t1]++;
    gamesCount[t2]++;
  });

  for (const t of teams) {
    if (gamesCount[t] !== gamesPerTeam) {
      alert(`Scheduling error: Team ${t} has ${gamesCount[t]} games instead of ${gamesPerTeam}.`);
      return [];
    }
  }

  return rounds;
}

function scheduleMatchTimes(fixtures, pitches, gameLength, enableBreaks, breakLength) {
  const rounds = [];
  const matchesPerRound = pitches;
  const timeIncrement = gameLength + (enableBreaks ? breakLength : 0);

  let unscheduled = [...fixtures];
  let currentTime = new Date();
  currentTime.setHours(9, 0, 0, 0); // Start at 9:00am

  while (unscheduled.length > 0) {
    const roundMatches = [];
    const playing = new Set();

    for (let i = 0; i < unscheduled.length; i++) {
      const [t1, t2] = unscheduled[i];
      if (!playing.has(t1) && !playing.has(t2)) {
        roundMatches.push({
          team1: t1,
          team2: t2,
          time: new Date(currentTime),
          pitch: (roundMatches.length % pitches) + 1
        });
        playing.add(t1);
        playing.add(t2);
        unscheduled.splice(i, 1);
        i--;
      }
      if (roundMatches.length >= matchesPerRound) break;
    }

    rounds.push(...roundMatches);
    currentTime.setMinutes(currentTime.getMinutes() + timeIncrement);
  }
  return rounds;
}

function displayFixtures(schedule) {
  const container = document.getElementById("fixtureList");
  container.innerHTML = "";
  schedule.forEach(m => {
    const timeStr = m.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const div = document.createElement("div");
    div.textContent = `${timeStr} | Pitch ${m.pitch}: ${m.team1} vs ${m.team2}`;
    container.appendChild(div);
  });
}

function displayTeamMatchLists(schedule, teams) {
  const container = document.getElementById("teamMatchLists");
  container.innerHTML = "";
  teams.forEach(team => {
    const matches = schedule.filter(m => m.team1 === team || m.team2 === team);
    const div = document.createElement("div");
    div.innerHTML = `<strong>${team}</strong>`;
    matches.forEach(m => {
      const opp = m.team1 === team ? m.team2 : m.team1;
      const timeStr = m.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const line = document.createElement("div");
      line.textContent = `vs ${opp} at ${timeStr} (Pitch ${m.pitch})`;
      div.appendChild(line);
    });
    container.appendChild(div);
  });
}

function exportCSV() {
  if (!scheduledFixtures.length) {
    alert("No fixtures to export. Please generate fixtures first.");
    return;
  }
  let csv = "Time,Pitch,Team 1,Team 2\n";
  scheduledFixtures.forEach(m => {
    const timeStr = m.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    csv += `${timeStr},${m.pitch},${m.team1},${m.team2}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "fixtures.csv";
  a.click();
  URL.revokeObjectURL(url);
}
