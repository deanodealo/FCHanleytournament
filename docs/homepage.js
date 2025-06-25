import { 
  saveFixtures, 
  loadFixtures, 
  saveResults, 
  loadResults, 
  loadTeams  // <-- added loadTeams import
} from './FIXTURES/firebasehelpers.js';
import { database } from './FIXTURES/firebase.js';

// ===== Constants =====
const STORAGE_KEY = 'tournamentData';
let tournamentData = {};  // initially empty

async function loadAllDataFromFirebase() {
  const ages = ['U7', 'U8', 'U9', 'U10'];
  for (const age of ages) {
    const [fixtures, results, teams] = await Promise.all([
      loadFixtures(age),
      loadResults(age),
      loadTeams(age)
    ]);
    tournamentData[age] = {
      fixtures: fixtures || [],
      results: results || [],
      teams: teams || []
    };
  }
}

// ===== DOM Elements =====
const tableBody = document.querySelector('#table tbody');
const resultsList = document.getElementById('results-list');
const fixturesList = document.getElementById('fixtures-list');
const ageGroupHeader = document.getElementById('age-group-header');
const ageGroupSelect = document.getElementById('age-group-select');
const autoCycleCheckbox = document.getElementById('auto-cycle');
const u7Checkbox = document.getElementById('u7-checkbox');
const u8Checkbox = document.getElementById('u8-checkbox');
const u9Checkbox = document.getElementById('u9-checkbox');
const u10Checkbox = document.getElementById('u10-checkbox');

let ageGroups = ['U7', 'U8', 'U9', 'U10'];
let currentAgeIndex = 0;
let cycleInterval = null;

// ===== Helper Functions =====

function ensureAgeGroupExists(age) {
  if (!tournamentData[age]) {
    tournamentData[age] = { teams: [], fixtures: [], results: [] };
  }
}

function calculateLeagueTable(age) {
  ensureAgeGroupExists(age);
  const teams = tournamentData[age].teams || [];
  const results = tournamentData[age].results || [];

  const stats = {};

  teams.forEach(team => {
    stats[team] = {
      team,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      points: 0,
      goalDifference: 0,
      goalsScored: 0,
      goalsConceded: 0
    };
  });

  results.forEach(result => {
    const { team1, team2, team1Score: score1, team2Score: score2 } = result;

    if (!stats[team1] || !stats[team2]) return;

    stats[team1].played += 1;
    stats[team2].played += 1;

    stats[team1].goalsScored += score1;
    stats[team2].goalsScored += score2;
    stats[team1].goalsConceded += score2;
    stats[team2].goalsConceded += score1;

    if (score1 > score2) {
      stats[team1].won += 1;
      stats[team2].lost += 1;
      stats[team1].points += 3;
    } else if (score2 > score1) {
      stats[team2].won += 1;
      stats[team1].lost += 1;
      stats[team2].points += 3;
    } else {
      stats[team1].drawn += 1;
      stats[team2].drawn += 1;
      stats[team1].points += 1;
      stats[team2].points += 1;
    }
  });

  Object.values(stats).forEach(team => {
    team.goalDifference = team.goalsScored - team.goalsConceded;
  });

  const sortedTeams = Object.values(stats).sort((a, b) =>
    b.points - a.points || b.goalDifference - a.goalDifference
  );

  return sortedTeams;
}


function renderLeagueTable(age) {
  const stats = calculateLeagueTable(age);
  tableBody.innerHTML = stats.length
    ? stats
        .map(
          team => `
        <tr>
          <td>${team.team}</td>
          <td>${team.played}</td>
          <td>${team.won}</td>
          <td>${team.drawn}</td>
          <td>${team.lost}</td>
          <td>${team.points}</td>
          <td>${team.goalDifference}</td>
        </tr>
      `
        )
        .join('')
    : `<tr><td colspan="7">No teams in ${age} yet.</td></tr>`;
}

function renderFixtures(age) {
  ensureAgeGroupExists(age);
  const fixtures = tournamentData[age].fixtures || [];
  const results = tournamentData[age].results || [];

  const unplayedFixtures = fixtures.filter(fixture => {
    return !results.some(result => {
      if (!result || !result.fixture) return false;
      const r = result.fixture;
      return (
        r.team1 === fixture.team1 &&
        r.team2 === fixture.team2 &&
        r.time === fixture.time &&
        r.pitch === fixture.pitch
      );
    });
  });

  fixturesList.innerHTML = unplayedFixtures.length
  ? unplayedFixtures
      .map(f => {
        const formattedTime = formatISOTimeTo12Hour(f.time);
        return `
          <li>
            <strong>${f.team1}</strong> - <strong>${f.team2}</strong><br/>
            <em>Time: ${formattedTime} | Pitch: ${f.pitch}</em>
          </li>
        `;
      })
      .join('')
  : '<li>No upcoming fixtures.</li>';
}

function formatISOTimeTo12Hour(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date)) return ''; // invalid date fallback
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
}

function renderResults(age) {
  ensureAgeGroupExists(age);
  const results = tournamentData[age].results || [];

  if (results.length === 0) {
    resultsList.innerHTML = '<li>No results recorded.</li>';
    return;
  }

  resultsList.innerHTML = results
    .map(r => {
      if (!r.team1 || !r.team2) return '';

      const { team1, team2, time, pitch, team1Score, team2Score } = r;
      const formattedTime = formatISOTimeTo12Hour(time);

      return `<li>
        <strong>${team1}</strong> ${team1Score} - ${team2Score} <strong>${team2}</strong><br/>
        <em>Time: ${formattedTime} | Pitch: ${pitch}</em>
      </li>`;
    })
    .join('');
}



function refreshAll(age) {
  ensureAgeGroupExists(age);
  ageGroupHeader.textContent = `${age} League Table`;

  const hasData =
    tournamentData[age].teams.length ||
    tournamentData[age].fixtures.length ||
    tournamentData[age].results.length;

  if (!hasData) {
    tableBody.innerHTML = `<tr><td colspan="7">No data for ${age} yet.</td></tr>`;
    resultsList.innerHTML = '<li>No results recorded.</li>';
    fixturesList.innerHTML = '<li>No upcoming fixtures.</li>';
    return;
  }

  renderLeagueTable(age);
  renderResults(age);
  renderFixtures(age);
}

function cycleAgeGroups() {
  if (cycleInterval) clearInterval(cycleInterval);
  if (!autoCycleCheckbox.checked) return;

  const selectedAgeGroups = [];
  if (u7Checkbox.checked) selectedAgeGroups.push('U7');
  if (u8Checkbox.checked) selectedAgeGroups.push('U8');
  if (u9Checkbox.checked) selectedAgeGroups.push('U9');
  if (u10Checkbox.checked) selectedAgeGroups.push('U10');

  if (selectedAgeGroups.length === 0) return;

  cycleInterval = setInterval(() => {
    currentAgeIndex = (currentAgeIndex + 1) % selectedAgeGroups.length;
    const newAge = selectedAgeGroups[currentAgeIndex];
    ageGroupSelect.value = newAge;
    refreshAll(newAge);
  }, 10000);
}

// ===== Event Listeners =====

ageGroupSelect.addEventListener('change', () => {
  const selectedAge = ageGroupSelect.value;
  currentAgeIndex = ageGroups.indexOf(selectedAge);
  refreshAll(selectedAge);
});

autoCycleCheckbox.addEventListener('change', () => {
  if (autoCycleCheckbox.checked) {
    cycleAgeGroups();
  } else if (cycleInterval) {
    clearInterval(cycleInterval);
    cycleInterval = null;
  }
});

[u7Checkbox, u8Checkbox, u9Checkbox, u10Checkbox].forEach(checkbox =>
  checkbox.addEventListener('change', cycleAgeGroups)
);

// ===== Initial Load =====

document.addEventListener('DOMContentLoaded', async () => {
  const initialAge = ageGroupSelect.value;
  currentAgeIndex = ageGroups.indexOf(initialAge);

  // Load all data from Firebase
  await loadAllDataFromFirebase();

  // Now refresh UI with loaded data
  refreshAll(initialAge);
});
