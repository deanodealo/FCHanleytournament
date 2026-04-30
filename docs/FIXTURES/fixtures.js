import { saveFixtures, loadFixtures, saveResults, loadResults, saveTeams } from './firebasehelpers.js';
import { database } from './firebase.js';

document.addEventListener('DOMContentLoaded', function () {
  // Dynamically update group options based on the selected number of groups
  document.getElementById('number-of-groups').addEventListener('change', function () {
    const groupSelect = document.getElementById('group-select');
    const numberOfGroups = parseInt(this.value, 10); // Get the number of groups selected

    // Clear previous group options
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
  container.innerHTML = "";  // Clear existing pitch inputs

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


// Generate fixtures function no longer calls updatePitchAssignmentUI
async function generateFixtures() {
  console.log('Generate Fixtures clicked!'); // Check if the function is triggered
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

  // Ensure teams are split by newline and filtered properly
  const teams = teamNamesRaw
    .split(/\r?\n/)
    .map(team => team.trim())
    .filter(team => team.length > 0);

    const teamsPerGroup = Math.ceil(teams.length / numberOfGroups); // Calculate the number of teams per group

let groups = [];
for (let i = 0; i < numberOfGroups; i++) {
  groups.push(teams.slice(i * teamsPerGroup, (i + 1) * teamsPerGroup)); // Split the teams into groups
}

console.log(groups); // Log the groups to check the output

  console.log("Teams:", teams);  // Log the teams to ensure they're being processed correctly

  if (teams.length < 2) {
    alert("Please enter at least two teams.");
    return;
  }

  // Process teams and allocate them to their respective age groups
  selectedAgeGroups.forEach(ageGroup => {
    ageGroupTeams[ageGroup] = teams;

    console.log("Selected groups:", selectedAgeGroups);
    console.log("Raw team names:", teamNamesRaw);
    console.log("Parsed teams:", ageGroupTeams);
  });

  // Ensure allocated pitches are properly assigned
  const pitchAllocations = {};

  selectedAgeGroups.forEach(ageGroup => {
    const input = document.getElementById(`pitches-${ageGroup}`);

    // Ensure the pitch input exists
    if (!input) {
      alert(`Missing pitch input for ${ageGroup}.`);
      return; // Exit if no input field exists for this age group
    }

    if (!input.value.trim()) {
      alert(`Please assign at least one pitch to ${ageGroup}.`);
      return; // Exit if no value is entered
    }

    const values = input.value
      .split(',')
      .map(s => parseInt(s.trim()))
      .filter(n => !isNaN(n));

    if (values.length === 0) {
      alert(`Please assign at least one valid pitch number to ${ageGroup}.`);
      return; // Exit if no valid pitch is entered
    }

    for (let pitch of values) {
      if (pitch < 1 || pitch > totalPitches) {
        alert(`Pitch ${pitch} is out of range (1–${totalPitches}).`);
        return; // Exit if the pitch number is out of range
      }
    }

    // Assign pitch values to the corresponding age group
    pitchAllocations[ageGroup] = values;
  });

  // Ensure that allocated pitches are defined for each selected age group
  selectedAgeGroups.forEach(ageGroup => {
    if (!pitchAllocations[ageGroup]) {
      alert(`Allocated pitches for ${ageGroup} are not defined.`);
      return; // Exit if allocated pitches are not defined for the current age group
    }
  });

  selectedAgeGroups.forEach(ageGroup => {
  const teamsInGroup = ageGroupTeams[ageGroup];

  // Validate teams before generating fixtures
  if (teamsInGroup.length < 2) {
    alert(`There are not enough teams in the ${ageGroup} group to generate fixtures.`);
    return; // Exit if there are not enough teams for the selected age group
  }

let groupFixtures = [];
let groupCount = 0; // Start from 0 so it works dynamically with multiple groups

for (let i = 0; i < numberOfGroups; i++) {
  const groupTeams = teamsInGroup.slice(i * Math.ceil(teamsInGroup.length / numberOfGroups), (i + 1) * Math.ceil(teamsInGroup.length / numberOfGroups));

  if (groupTeams.length < 2) continue;

  const groupName = `Group ${String.fromCharCode(65 + groupCount)}`; // Dynamically create group names like Group A, Group B, etc.
  const generatedFixtures = generateRoundRobin(groupTeams).map(f => ({
    group: groupName,
    match: f.match,
    round: f.round
  }));

  groupFixtures.push(...generatedFixtures);
  groupCount++;  // Move to the next group name (Group A, Group B, etc.)
}

  fixtures.push(...groupFixtures);
});

  console.log("All Generated Fixtures:", fixtures); // Check if fixtures are generated

  if (fixtures.length === 0) {
    alert("No fixtures generated. Please check team input.");
    return; // Exit if no fixtures were generated
  }

  const groupPitchMap = {
  "Group A": pitchAllocations[ageGroup][0],
  "Group B": pitchAllocations[ageGroup][1] || pitchAllocations[ageGroup][0]
};

  const scheduledAll = [];
  const globalPitchSchedule = {}; 
  const currentAgeGroup = selectedAgeGroups[0];
const allocatedPitches = pitchAllocations[currentAgeGroup];

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
  groupPitchMap   // 👈 NEW
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

// Round-robin fixture generator (this is the correct one)
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
      fixtureDiv.textContent = `${formatTime(fixture.time)} | Pitch ${fixture.pitch} | ${fixture.team1} vs ${fixture.team2}`;
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
      matchDiv.textContent = `${formatTime(fixture.time)} | Pitch ${fixture.pitch} vs ${opponent}`;
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