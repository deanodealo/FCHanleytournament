import { saveFixtures, loadFixtures, saveResults, loadResults, saveTeams } from './firebasehelpers.js';
import { database } from './firebase.js';

let scheduledFixtures = [];

function updatePitchAssignmentUI(selectedAgeGroups, totalPitches) {
  const container = document.getElementById("pitchAssignments");
  container.innerHTML = "";

  selectedAgeGroups.forEach(age => {
    const div = document.createElement("div");
    div.innerHTML = `
      <label>
        ${age} → Pitches:
        <input type="text" id="pitches-${age}" placeholder="e.g. 1,2,3" style="width: 100px;">
      </label>
    `;
    container.appendChild(div);
  });
}

// Generate fixtures function no longer calls updatePitchAssignmentUI
function generateFixtures() {
  const ageGroupSelect = document.getElementById("ageGroup");
  const selectedAgeGroups = Array.from(ageGroupSelect.selectedOptions).map(opt => opt.value);

  const totalPitches = parseInt(document.getElementById("pitches").value);
  const gameLength = parseInt(document.getElementById("matchLength").value);
  const gamesPerTeam = parseInt(document.getElementById("gamesPerTeam").value);
  const enableBreaks = document.getElementById("enableBreaks").checked;
  const breakLength = parseInt(document.getElementById("breakLength").value) || 0;

  const teamNamesRaw = document.getElementById("teamNames").value.trim();
  if (!teamNamesRaw) {
    alert("Please enter team names.");
    return;
  }

  const ageGroupTeams = {};
  teamNamesRaw.split("\n").forEach(line => {
    const [group, teamsStr] = line.split(":");
    if (group && teamsStr) {
      ageGroupTeams[group.trim()] = teamsStr.split(",").map(t => t.trim()).filter(t => t);
    }
  });

  for (const ageGroup of selectedAgeGroups) {
    const teams = ageGroupTeams[ageGroup];
    if (!teams || teams.length < 2) {
      alert(`Please enter at least 2 teams for ${ageGroup}.`);
      return;
    }
    if (gamesPerTeam > teams.length - 1) {
      alert(`Games per team for ${ageGroup} cannot exceed number of opponents.`);
      return;
    }
  }

const pitchAllocations = {};

for (const ageGroup of selectedAgeGroups) {
  const input = document.getElementById(`pitches-${ageGroup}`);
  if (!input) {
    alert(`Missing pitch input for ${ageGroup}.`);
    return;
  }

  if (!input.value.trim()) {
    alert(`Please assign at least one pitch to ${ageGroup}.`);
    return;
  }

  const values = input.value
    .split(',')
    .map(s => parseInt(s.trim()))
    .filter(n => !isNaN(n));

  if (values.length === 0) {
    alert(`Please assign at least one valid pitch number to ${ageGroup}.`);
    return;
  }

  for (let pitch of values) {
    if (pitch < 1 || pitch > totalPitches) {
      alert(`Pitch ${pitch} is out of range (1–${totalPitches}).`);
      return;
    }
  }

  pitchAllocations[ageGroup] = values;
}


  const scheduledAll = [];

  const globalPitchSchedule = {}; // Tracks pitch usage across all age groups

  for (const ageGroup of selectedAgeGroups) {
    const teams = ageGroupTeams[ageGroup];
    const allocatedPitches = pitchAllocations[ageGroup];

    const fixtures = generateMatchups(teams, gamesPerTeam);
    if (fixtures.length === 0) continue;

  // Use a fresh time object for each group
  const groupStartTime = new Date();
  groupStartTime.setHours(9, 0, 0, 0);

  console.log(`${ageGroup} allocated pitches:`, allocatedPitches);

const scheduled = scheduleMatchTimes(
  fixtures,
  allocatedPitches.length,
  gameLength,
  enableBreaks,
  breakLength,
  allocatedPitches,
  groupStartTime,
  globalPitchSchedule // 👈 new argument
);



    saveTeams(ageGroup, teams);
    saveFixtures(ageGroup, scheduled);

    scheduledAll.push({ ageGroup, scheduled, teams });
  }

  document.getElementById("fixtureList").innerHTML = "";
  document.getElementById("teamMatchLists").innerHTML = "";

  for (const { ageGroup, scheduled, teams } of scheduledAll) {
    const groupHeader = document.createElement("h3");
    groupHeader.textContent = `Fixtures for ${ageGroup}`;
    document.getElementById("fixtureList").appendChild(groupHeader);
    displayFixtures(scheduled);

    const teamListHeader = document.createElement("h3");
    teamListHeader.textContent = `${ageGroup} Team Schedules`;
    document.getElementById("teamMatchLists").appendChild(teamListHeader);
    displayTeamMatchLists(scheduled, teams);
  }

  alert("Fixtures generated and saved for all selected age groups.");
  scheduledFixtures = scheduledAll.flatMap(g => g.scheduled);
}

/**
 * Round-robin partial schedule generator
 */
function generateMatchups(teams, gamesPerTeam) {
  const maxGames = teams.length - 1;
  if (gamesPerTeam > maxGames) {
    alert("Games per team cannot exceed number of opponents (teams - 1).");
    return [];
  }

  const allPairs = [];
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      allPairs.push([teams[i], teams[j]]);
    }
  }

  // Shuffle to add randomness
  for (let i = allPairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allPairs[i], allPairs[j]] = [allPairs[j], allPairs[i]];
  }

  const matchCounts = {};
  teams.forEach(t => (matchCounts[t] = 0));
  const selectedMatches = [];

  function backtrack(index) {
    if (index >= allPairs.length) return false;
    const [t1, t2] = allPairs[index];

    const canUse =
      matchCounts[t1] < gamesPerTeam && matchCounts[t2] < gamesPerTeam;

    // Try this match
    if (canUse) {
      selectedMatches.push([t1, t2]);
      matchCounts[t1]++;
      matchCounts[t2]++;

      if (selectedMatches.length === (teams.length * gamesPerTeam) / 2) {
        return true; // done
      }

      if (backtrack(index + 1)) return true;

      // Backtrack
      selectedMatches.pop();
      matchCounts[t1]--;
      matchCounts[t2]--;
    }

    // Try skipping this match
    return backtrack(index + 1);
  }

  const success = backtrack(0);

  if (!success) {
    alert("Unable to generate a balanced fixture list. Try fewer games.");
    return [];
  }

  return selectedMatches;
}



function scheduleMatchTimes(
  fixtures,
  numPitches,
  gameLength,
  enableBreaks,
  breakLength,
  pitchArray = [],
  startTime = null,
  globalPitchSchedule = {}
) {
  const rounds = [];
  const matchesPerRound = numPitches;
  const timeIncrement = gameLength + (enableBreaks ? breakLength : 0);

  let unscheduled = [...fixtures];
  let currentTime = startTime ? new Date(startTime) : new Date();
  currentTime.setSeconds(0, 0);

  const lastPlayedRound = {};
  const consecutiveMatches = {};
  const scheduledAtTime = {};
  let roundNumber = 0;
  let pitchIndex = 0;

  let maxRounds = 500; // safeguard to prevent infinite loop

  while (unscheduled.length > 0 && roundNumber < maxRounds) {
    const roundMatches = [];
    const playingThisRound = new Set();
    const timeKey = currentTime.toISOString();
    if (!scheduledAtTime[timeKey]) scheduledAtTime[timeKey] = new Set();

    const candidates = [...unscheduled];
    let matchScheduledThisRound = false;

    for (const [t1, t2] of candidates) {
      if (
        playingThisRound.has(t1) || playingThisRound.has(t2) ||
        (consecutiveMatches[t1] || 0) >= 2 || (consecutiveMatches[t2] || 0) >= 2 ||
        (lastPlayedRound[t1] != null && roundNumber - lastPlayedRound[t1] > 4) ||
        (lastPlayedRound[t2] != null && roundNumber - lastPlayedRound[t2] > 4) ||
        scheduledAtTime[timeKey].has(t1) || scheduledAtTime[timeKey].has(t2)
      ) {
        continue;
      }

      // Try to find a pitch that is available globally at this time
      let pitchFound = null;
      for (let i = 0; i < pitchArray.length; i++) {
        const pitch = pitchArray[i];
        if (!globalPitchSchedule[pitch]) globalPitchSchedule[pitch] = {};
        if (!globalPitchSchedule[pitch][timeKey]) {
          pitchFound = pitch;
          break;
        }
      }

      if (!pitchFound) continue;

      const match = {
        team1: t1,
        team2: t2,
        time: new Date(currentTime).toISOString(),
        pitch: pitchFound,
      };

      roundMatches.push(match);
      playingThisRound.add(t1);
      playingThisRound.add(t2);
      scheduledAtTime[timeKey].add(t1);
      scheduledAtTime[timeKey].add(t2);
      lastPlayedRound[t1] = roundNumber;
      lastPlayedRound[t2] = roundNumber;
      consecutiveMatches[t1] = (consecutiveMatches[t1] || 0) + 1;
      consecutiveMatches[t2] = (consecutiveMatches[t2] || 0) + 1;

      globalPitchSchedule[pitchFound][timeKey] = true;

      unscheduled = unscheduled.filter(([a, b]) => !(a === t1 && b === t2));
      pitchIndex++;
      matchScheduledThisRound = true;

      if (roundMatches.length >= matchesPerRound) break;
    }

    // Reset consecutive match streaks for teams not playing this round
    for (const team of Object.keys(consecutiveMatches)) {
      if (!playingThisRound.has(team)) consecutiveMatches[team] = 0;
    }

    if (roundMatches.length > 0) {
      rounds.push(...roundMatches);
    }

    currentTime.setMinutes(currentTime.getMinutes() + timeIncrement);
    roundNumber++;

    // 🚨 Bail out if nothing got scheduled this round — prevents infinite loop
if (!matchScheduledThisRound) {
  console.warn(`No matches could be scheduled at ${timeKey}. Advancing time...`);
  // Don't break — let time keep moving until we can schedule again
}

  }

  return rounds;
}









function displayFixtures(schedule) {
  const container = document.getElementById("fixtureList");
  schedule.forEach(m => {
    const timeStr = new Date(m.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const div = document.createElement("div");
    div.textContent = `${timeStr} | Pitch ${m.pitch}: ${m.team1} vs ${m.team2}`;
    container.appendChild(div);
  });
}

function displayTeamMatchLists(schedule, teams) {
  const container = document.getElementById("teamMatchLists");
  teams.forEach(team => {
    const matches = schedule.filter(m => m.team1 === team || m.team2 === team);
    const div = document.createElement("div");
    div.innerHTML = `<strong>${team}</strong>`;
    matches.forEach(m => {
      const opp = m.team1 === team ? m.team2 : m.team1;
      const timeStr = new Date(m.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
    const timeStr = new Date(m.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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

// Set up listeners to update pitch assignment UI when age groups change
document.getElementById("ageGroup").addEventListener("change", () => {
  const ageGroupSelect = document.getElementById("ageGroup");
  const selectedAgeGroups = Array.from(ageGroupSelect.selectedOptions).map(opt => opt.value);
  const totalPitches = parseInt(document.getElementById("pitches").value);
  updatePitchAssignmentUI(selectedAgeGroups, totalPitches);
});

// Optional: update pitch inputs if total pitches number changes
document.getElementById("pitches").addEventListener("input", () => {
  const ageGroupSelect = document.getElementById("ageGroup");
  const selectedAgeGroups = Array.from(ageGroupSelect.selectedOptions).map(opt => opt.value);
  const totalPitches = parseInt(document.getElementById("pitches").value);
  updatePitchAssignmentUI(selectedAgeGroups, totalPitches);
});

// Initialize pitch assignment inputs on page load
window.addEventListener("DOMContentLoaded", () => {
  const ageGroupSelect = document.getElementById("ageGroup");
  const selectedAgeGroups = Array.from(ageGroupSelect.selectedOptions).map(opt => opt.value);
  const totalPitches = parseInt(document.getElementById("pitches").value);
  updatePitchAssignmentUI(selectedAgeGroups, totalPitches);
});

// Generate button event
document.getElementById('generateBtn').addEventListener('click', generateFixtures);

