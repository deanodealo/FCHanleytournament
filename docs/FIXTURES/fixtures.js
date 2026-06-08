import { saveFixtures, loadFixtures, saveResults, loadResults, saveTeams } from './firebasehelpers.js';
import { database } from './firebase.js';

document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('number-of-groups').addEventListener('change', function () {
    const groupSelect = document.getElementById('group-select');
    const numberOfGroups = parseInt(this.value, 10);

    if (!groupSelect) return;

    groupSelect.innerHTML = '<option value="all">All / Single Group</option>';

    // Add new group options dynamically
    for (let i = 0; i < numberOfGroups; i++) {
      groupSelect.innerHTML += `<option value="Group ${String.fromCharCode(65 + i)}">Group ${String.fromCharCode(65 + i)}</option>`;
    }
  });

  // Your other code for generating fixtures goes here
});

function getSelectedTournamentPath() {
  const ageGroup = document.getElementById("ageGroup").value;
  const day = document.getElementById("fixtureDay").value;
  const session = document.getElementById("fixtureSession").value;

  return { day, session, ageGroup };
}

let scheduledFixtures = [];

function updatePitchAssignmentUI(selectedAgeGroups, totalPitches) {
  const container = document.getElementById("pitchAssignments");
  container.innerHTML = "";

  selectedAgeGroups.forEach(age => {
    const groupDiv = document.createElement("div");
    groupDiv.style.marginBottom = "16px";

    const groupLabel = document.createElement("div");
    groupLabel.textContent = `${age} — Pitch Names`;
    groupLabel.style.cssText = "font-size:0.85rem;font-weight:600;color:#a0b8d0;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px;";
    groupDiv.appendChild(groupLabel);

    const namesGrid = document.createElement("div");
    namesGrid.style.cssText = "display:flex;flex-wrap:wrap;gap:10px;";
    namesGrid.id = `pitch-names-${age}`;

    for (let i = 1; i <= totalPitches; i++) {
      const fieldDiv = document.createElement("div");
      fieldDiv.style.cssText = "display:flex;flex-direction:column;gap:4px;";

      const lbl = document.createElement("label");
      lbl.textContent = `Pitch ${i}`;
      lbl.style.cssText = "font-size:0.75rem;color:#7ec8ff;";

      const input = document.createElement("input");
      input.type = "text";
      input.id = `pitch-name-${age}-${i}`;
      input.placeholder = `Pitch ${i}`;
      input.style.cssText = "width:180px;padding:8px 10px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:8px;color:#fff;font-size:14px;";

      fieldDiv.appendChild(lbl);
      fieldDiv.appendChild(input);
      namesGrid.appendChild(fieldDiv);
    }

    groupDiv.appendChild(namesGrid);
    container.appendChild(groupDiv);
  });
}

function splitIntoGroups(teams) {
  const shuffled = [...teams].sort(() => Math.random() - 0.5);

  // Split the teams into the selected number of groups
  const groups = [];
  const teamsPerGroup = Math.ceil(shuffled.length / numberOfGroups);

  const groupNames = ['A', 'B', 'C', 'D', 'E', 'F']; // Add more if selecting more groups
  let groupCount = 0;

  for (let i = 0; i < numberOfGroups; i++) {
    const groupName = `Group ${groupNames[groupCount]}`;
    
    groups.push({
      name: groupName,  // Name of the group (Group A, Group B, etc.)
      teams: shuffled.slice(i * teamsPerGroup, (i + 1) * teamsPerGroup)  // Teams in the group
    });

    groupCount++;
  }

  return groups; // Return the groups with their assigned names
}


// Define scheduleMatchTimes function here before calling it
function scheduleMatchTimes(
  fixtures,
  numPitches,
  gameLength,
  enableBreaks,
  breakLength,
  pitchArray = [],
  startTime = null,
  globalPitchSchedule = {},
  groupPitchMap = {}
) {
  const scheduled = [];
  const timeIncrement = gameLength + (enableBreaks ? breakLength : 0);

  let unscheduled = [...fixtures];
  let currentTime = startTime ? new Date(startTime) : new Date();
  currentTime.setSeconds(0, 0);

  const lastPlayedSlot = {};

  while (unscheduled.length > 0) {
    const timeKey = currentTime.toISOString();
    const playingThisSlot = new Set();

    let matchesThisSlot = 0;

    // Sort matches so teams that have waited longest are prioritised
const candidates = [...unscheduled].sort((a, b) => {
  // Primary: keep rounds in order so all teams finish together
  if ((a.round ?? 0) !== (b.round ?? 0)) return (a.round ?? 0) - (b.round ?? 0);

  // Secondary: teams that have waited longest get priority within a round
  const [a1, a2] = a.match || a;
  const [b1, b2] = b.match || b;

  const aLast = Math.max(
    lastPlayedSlot[a1] ?? -999,
    lastPlayedSlot[a2] ?? -999
  );

  const bLast = Math.max(
    lastPlayedSlot[b1] ?? -999,
    lastPlayedSlot[b2] ?? -999
  );

  return aLast - bLast;
});

    let scheduledSomething = false;

    for (const fixture of candidates) {
  const [t1, t2] = fixture.match || fixture;
      if (playingThisSlot.has(t1) || playingThisSlot.has(t2)) {
        continue;
      }

      let pitchFound = null;

// 🔒 Force pitch based on group
if (fixture.group && groupPitchMap[fixture.group]) {
  const preferredPitch = groupPitchMap[fixture.group];

  if (!globalPitchSchedule[preferredPitch]) {
    globalPitchSchedule[preferredPitch] = {};
  }

  // If this group's pitch is already busy at this time,
  // skip this fixture and try another one.
  if (globalPitchSchedule[preferredPitch][timeKey]) {
    continue;
  }

  pitchFound = preferredPitch;
} else {
  // fallback only for fixtures without a group
  for (const pitch of pitchArray) {
    if (!globalPitchSchedule[pitch]) globalPitchSchedule[pitch] = {};

    if (!globalPitchSchedule[pitch][timeKey]) {
      pitchFound = pitch;
      break;
    }
  }
}

const slotIndex = scheduled.length;
lastPlayedSlot[t1] = slotIndex;
lastPlayedSlot[t2] = slotIndex;

playingThisSlot.add(t1);
playingThisSlot.add(t2);
globalPitchSchedule[pitchFound][timeKey] = true;

// ✅ ADD THIS (this is what was missing)
scheduled.push({
  time: currentTime.toISOString(),
  pitch: pitchFound,
  group: fixture.group || "",
  team1: t1,
  team2: t2
});

unscheduled = unscheduled.filter(item => item !== fixture);

matchesThisSlot++;
scheduledSomething = true;

if (matchesThisSlot >= numPitches) break;
}

if (!scheduledSomething) {
  console.warn("Could not schedule any match at", timeKey);
  break;
}

currentTime.setMinutes(currentTime.getMinutes() + timeIncrement);
}

return scheduled;
}

function generateRoundRobin(teams) {
  const teamList = teams.length % 2 === 0 ? [...teams] : [...teams, null];
  const size = teamList.length;
  const rounds = size - 1;
  const half = size / 2;
  const fixtures = [];
  const rotating = teamList.slice(1);

  for (let round = 0; round < rounds; round++) {
    const rotated = [
      teamList[0],
      ...rotating.slice(rotating.length - round).concat(rotating.slice(0, rotating.length - round))
    ];
    for (let i = 0; i < half; i++) {
      const t1 = rotated[i];
      const t2 = rotated[size - 1 - i];
      if (t1 && t2) {
        fixtures.push({ match: [t1, t2], round });
      }
    }
  }
  return fixtures;
}

async function generateFixtures() {
  console.log('Generate Fixtures clicked!');
  let fixtures = [];

  const ageGroupSelect = document.getElementById("ageGroup");
  const selectedAgeGroups = Array.from(ageGroupSelect.selectedOptions).map(opt => opt.value);

  const { day, session, ageGroup } = getSelectedTournamentPath();

  const totalPitches = parseInt(document.getElementById("pitches").value);
  const gameLength = parseInt(document.getElementById("matchLength").value);
  const enableBreaks = document.getElementById("enableBreaks").checked;
  const breakLength = parseInt(document.getElementById("breakLength").value) || 0;

  const teamNamesRaw = document.getElementById("teamNames").value.trim();
  if (!teamNamesRaw) {
    alert("Please enter team names.");
    return;
  }

  const numberOfGroups = document.getElementById("number-of-groups").value;

  const ageGroupTeams = {};

  const teams = teamNamesRaw
    .split(/\r?\n/)
    .map(team => team.trim())
    .filter(team => team.length > 0);

  const teamsPerGroup = Math.ceil(teams.length / numberOfGroups);

  let groups = [];
  for (let i = 0; i < numberOfGroups; i++) {
    groups.push(teams.slice(i * teamsPerGroup, (i + 1) * teamsPerGroup));
  }

  console.log(groups);
  console.log("Teams:", teams);

  if (teams.length < 2) {
    alert("Please enter at least two teams.");
    return;
  }

  selectedAgeGroups.forEach(ageGroup => {
    ageGroupTeams[ageGroup] = teams;
  });

  // Build pitch allocations from named pitch inputs
  const pitchAllocations = {};

  selectedAgeGroups.forEach(ageGroup => {
    const pitchNames = [];
    for (let i = 1; i <= totalPitches; i++) {
      const nameInput = document.getElementById(`pitch-name-${ageGroup}-${i}`);
      const name = nameInput && nameInput.value.trim() ? nameInput.value.trim() : `Pitch ${i}`;
      pitchNames.push(name);
    }
    if (pitchNames.length === 0) {
      alert(`No pitches found for ${ageGroup}. Please select the age group first.`);
      return;
    }
    pitchAllocations[ageGroup] = pitchNames;
  });

  // Ensure allocations exist for all selected age groups
  for (const ageGroup of selectedAgeGroups) {
    if (!pitchAllocations[ageGroup]) {
      alert(`Allocated pitches for ${ageGroup} are not defined.`);
      return;
    }
  }

  selectedAgeGroups.forEach(ageGroup => {
    const teamsInGroup = ageGroupTeams[ageGroup];

    if (teamsInGroup.length < 2) {
      alert(`There are not enough teams in the ${ageGroup} group to generate fixtures.`);
      return;
    }

    let groupFixtures = [];
    let groupCount = 0;

    for (let i = 0; i < numberOfGroups; i++) {
      const groupTeams = teamsInGroup.slice(
        i * Math.ceil(teamsInGroup.length / numberOfGroups),
        (i + 1) * Math.ceil(teamsInGroup.length / numberOfGroups)
      );

      if (groupTeams.length < 2) continue;

      const groupName = `Group ${String.fromCharCode(65 + groupCount)}`;
      const generatedFixtures = generateRoundRobin(groupTeams).map(f => ({
        group: groupName,
        match: f.match,
        round: f.round
      }));

      groupFixtures.push(...generatedFixtures);
      groupCount++;
    }

    fixtures.push(...groupFixtures);
  });

  console.log("All Generated Fixtures:", fixtures);

  if (fixtures.length === 0) {
    alert("No fixtures generated. Please check team input.");
    return;
  }

  const currentAgeGroup = selectedAgeGroups[0];
  const allocatedPitches = pitchAllocations[currentAgeGroup];

  // Map groups to pitch names
  const groupPitchMap = {};
  allocatedPitches.forEach((pitchName, index) => {
    const groupName = `Group ${String.fromCharCode(65 + index)}`;
    groupPitchMap[groupName] = pitchName;
  });

  const scheduledAll = [];
  const globalPitchSchedule = {};

  const startTimeInput = document.getElementById('startTime').value || "09:00";
  const [startHour, startMinute] = startTimeInput.split(":").map(Number);

  const groupStartTime = new Date();
  groupStartTime.setHours(startHour, startMinute, 0, 0);

  const scheduled = scheduleMatchTimes(
    fixtures,
    allocatedPitches.length,
    gameLength,
    enableBreaks,
    breakLength,
    allocatedPitches,
    groupStartTime,
    globalPitchSchedule,
    groupPitchMap
  );

  await saveTeams(`${day}/${session}/${currentAgeGroup}`, teams);
  await saveFixtures(`${day}/${session}/${currentAgeGroup}`, scheduled);

  scheduledAll.push({ ageGroup: currentAgeGroup, scheduled, teams });

  document.getElementById("fixtureList").innerHTML = "";

  for (const { ageGroup, scheduled, teams } of scheduledAll) {
    const groupHeader = document.createElement("h3");
    groupHeader.textContent = `Fixtures for ${ageGroup}`;
    document.getElementById("fixtureList").appendChild(groupHeader);
    displayFixtures(scheduled);
  }

  alert("Fixtures generated and saved for all selected age groups.");
  scheduledFixtures = scheduledAll.flatMap(g => g.scheduled);
}

function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function displayFixtures(fixtures) {
  const groupSelect = document.getElementById("group-select");
  const selectedGroup = groupSelect ? groupSelect.value : "all"; // Default to "all" if no group selected
  
  const fixturesForGroup = fixtures.filter(fixture => {
    if (selectedGroup === "all") return true; // Show all fixtures if "all" is selected
    return fixture.group === selectedGroup; // Filter by group if a specific group is selected
  });

  const fixtureList = document.getElementById("fixtureList");
  fixtureList.innerHTML = ""; // Clear existing fixture list

  // Create a wrapper for displaying the fixtures
  const wrapper = document.createElement("div");
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.gap = "20px";  // Space between groups

  // Dynamically create group sections
  const groups = [...new Set(fixturesForGroup.map(fixture => fixture.group))]; // Get all unique groups from the fixtures
  groups.forEach(group => {
    const groupFixtures = fixturesForGroup.filter(fixture => fixture.group === group); // Filter fixtures by group

    // Create a section for each group
    const groupSection = document.createElement("div");
    groupSection.style.border = "1px solid #ccc";  // Add a border around the group section
    groupSection.style.padding = "10px";
    groupSection.style.borderRadius = "5px";

    // Group name header
    const groupHeading = document.createElement("h3");
    groupHeading.textContent = group;  // Display the group name dynamically (Group A, Group B, etc.)
    groupSection.appendChild(groupHeading);

    // Display fixtures for this group
    groupFixtures.forEach(fixture => {
      const fixtureDiv = document.createElement("div");
      fixtureDiv.textContent = `${formatTime(fixture.time)} | ${fixture.pitch} | ${fixture.team1} vs ${fixture.team2}`;
      groupSection.appendChild(fixtureDiv);
    });

    // Append the group section to the wrapper
    wrapper.appendChild(groupSection);
  });

  // Append the wrapper (with group sections) to the fixture list
  fixtureList.appendChild(wrapper);


  teams.forEach(team => {
    const teamDiv = document.createElement("div");
    teamDiv.innerHTML = `<h4>${team}</h4>`;

    const teamFixtures = fixtures.filter(
      fixture => fixture.team1 === team || fixture.team2 === team
    );

    teamFixtures.forEach(fixture => {
      const opponent = fixture.team1 === team ? fixture.team2 : fixture.team1;

      const matchDiv = document.createElement("div");
      matchDiv.textContent = `${formatTime(fixture.time)} | ${fixture.pitch} vs ${opponent}`;
      teamDiv.appendChild(matchDiv);
    });

    teamMatchLists.appendChild(teamDiv);
  });
}


// Add event listener for the Generate Fixtures button
document.getElementById('generateFixturesButton').addEventListener('click', generateFixtures);

// Call updatePitchAssignmentUI when age group is selected
document.getElementById('ageGroup').addEventListener('change', function() {
  const selectedAgeGroups = Array.from(this.selectedOptions).map(opt => opt.value);
  const totalPitches = parseInt(document.getElementById("pitches").value);
  updatePitchAssignmentUI(selectedAgeGroups, totalPitches);
});

document.getElementById('pitches').addEventListener('change', function() {
  const selectedAgeGroups = Array.from(document.getElementById('ageGroup').selectedOptions).map(opt => opt.value);
  const totalPitches = parseInt(this.value);
  if (selectedAgeGroups.length > 0) {
    updatePitchAssignmentUI(selectedAgeGroups, totalPitches);
  }
});


// ─────────────────────────────────────────────
// CSV IMPORT  (Registration CSV → Team Names)
// ─────────────────────────────────────────────

/**
 * Parse a single CSV row, handling quoted fields that may contain commas.
 */
function parseCSVRow(row) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      if (inQuotes && row[i + 1] === '"') {
        // Escaped double-quote inside a quoted field
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

/**
 * Read the uploaded CSV, filter by the age group(s) currently selected
 * in the fixture generator, and populate the Team Names textarea.
 */
function importFromCSV(file) {
  const reader = new FileReader();

  reader.onload = function (e) {
    const text = e.target.result;
    const lines = text.split(/\r?\n/).filter(l => l.trim());

    if (lines.length < 2) {
      alert("The CSV file appears to be empty.");
      return;
    }

    // Locate required columns
    const headers = parseCSVRow(lines[0]).map(h => h.trim());
    const teamNameIdx = headers.indexOf("Team Name");
    const ageGroupIdx = headers.indexOf("Age Group");

    if (teamNameIdx === -1 || ageGroupIdx === -1) {
      alert(
        "This doesn't look like an FC Hanley registration CSV.\n" +
        "Please export it from the Admin Registrations page and try again."
      );
      return;
    }

    // Which age group(s) are selected in the fixture generator?
    const ageGroupSelect = document.getElementById("ageGroup");
    const selectedAgeGroups = Array.from(ageGroupSelect.selectedOptions).map(opt => opt.value);

    if (selectedAgeGroups.length === 0) {
      alert("Please select at least one age group in the fixture settings first.");
      return;
    }

    // Filter rows and collect team names
    const teams = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const row = parseCSVRow(lines[i]);
      const ageGroup = (row[ageGroupIdx] || "").trim();
      const teamName = (row[teamNameIdx] || "").trim();
      if (teamName && selectedAgeGroups.includes(ageGroup)) {
        teams.push(teamName);
      }
    }

    if (teams.length === 0) {
      alert(
        `No teams found for ${selectedAgeGroups.join(", ")} in this CSV.\n` +
        "Check that the age group selection matches the registrations."
      );
      return;
    }

    document.getElementById("teamNames").value = teams.join("\n");
    alert(`✅ Imported ${teams.length} team(s) for ${selectedAgeGroups.join(", ")}.`);
  };

  reader.onerror = function () {
    alert("Could not read the file. Please try again.");
  };

  reader.readAsText(file);
}

// Wire up the Import button and hidden file input
document.getElementById("importCsvBtn").addEventListener("click", () => {
  document.getElementById("csvImportInput").click();
});

document.getElementById("csvImportInput").addEventListener("change", function () {
  if (this.files && this.files[0]) {
    importFromCSV(this.files[0]);
    // Reset so the same file can be re-imported after a change
    this.value = "";
  }
});