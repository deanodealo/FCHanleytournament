import { 
  saveFixtures, 
  loadFixtures, 
  saveResults, 
  loadResults, 
  loadTeams  // <-- added loadTeams import
} from './FIXTURES/firebasehelpers.js';
import { database } from './FIXTURES/firebase.js';
import { ref, onValue, off } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// ===== Constants =====

const STORAGE_KEY = 'tournamentData';
let tournamentData = {};  // initially empty
let activeTournamentRef = null;

function listenToSelectedDataFromFirebase() {
  const day = document.getElementById("day-select").value;
  const session = document.getElementById("session-select").value;
  const age = document.getElementById("age-group-select").value;

  const path = `tournamentData/${day}/${session}/${age}`;

  if (activeTournamentRef) {
    off(activeTournamentRef);
  }

  activeTournamentRef = ref(database, path);

  const toArray = val => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    return Object.values(val);
  };

  onValue(activeTournamentRef, snapshot => {
    const data = snapshot.val() || {};

    tournamentData[age] = {
      fixtures: toArray(data.fixtures),
      results: toArray(data.results),
      teams: toArray(data.teams)
    };

    refreshAll(age);
  });
}

// ===== DOM Elements =====
const tableBody = document.querySelector('#table tbody');
const resultsList = document.getElementById('results-list');
const fixturesList = document.getElementById('fixtures-list');
const ageGroupHeader = document.getElementById('age-group-header');
const ageGroupSelect = document.getElementById('age-group-select');
const groupSelect = document.getElementById('group-select');


let ageGroups = ['U7', 'U8', 'U9', 'U10'];


// ===== Helper Functions =====

function ensureAgeGroupExists(age) {
  if (!tournamentData[age]) {
    tournamentData[age] = { teams: [], fixtures: [], results: [] };
  }
}

function calculateLeagueTable(age) {
  ensureAgeGroupExists(age);
  const selectedGroup = groupSelect.value;

  const fixtures = tournamentData[age].fixtures || [];

  const groupTeams = fixtures
    .filter(fixture => selectedGroup === "all" || fixture.group === selectedGroup)
    .flatMap(fixture => [fixture.team1, fixture.team2]);

  const teams = selectedGroup === "all"
    ? tournamentData[age].teams || []
    : [...new Set(groupTeams)];

  const results = (tournamentData[age].results || []).filter(result => {
    if (selectedGroup === "all") return true;

    const matchingFixture = fixtures.find(fixture =>
      fixture.team1 === result.team1 &&
      fixture.team2 === result.team2 &&
      fixture.time === result.time &&
      fixture.pitch === result.pitch
    );

    return matchingFixture?.group === selectedGroup;
  });

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
  const fixtures = tournamentData[age].fixtures || [];
  const uniqueGroups = [...new Set(fixtures.map(f => f.group).filter(Boolean))];
  const qualifyingSpots = uniqueGroups.length === 1 ? 4 : 2;

  const stats = calculateLeagueTable(age);
  tableBody.innerHTML = stats.length
    ? stats
        .map(
          (team, index) => `
        <tr class="${index < qualifyingSpots ? 'qualification-place' : ''}">
          <td>${team.team}</td>
          <td>${team.played}</td>
          <td>${team.won}</td>
          <td>${team.drawn}</td>
          <td>${team.lost}</td>
          <td>${team.goalDifference}</td>
          <td>${team.points}</td>
        </tr>
      `
        )
        .join('')
    : `<tr><td colspan="7">No teams in ${age} yet.</td></tr>`;
}

function renderFixtures(age) {
  ensureAgeGroupExists(age);
  const selectedGroup = groupSelect.value;

const fixtures = (tournamentData[age].fixtures || []).filter(fixture => {
  if (selectedGroup === "all") return true;
  return fixture.group === selectedGroup;
});
  const results = tournamentData[age].results || [];

  const unplayedFixtures = fixtures.filter(fixture => {
    return !results.some(result => {
      if (!result) return false;

return (
  result.team1 === fixture.team1 &&
  result.team2 === fixture.team2 &&
  result.time === fixture.time &&
  result.pitch === fixture.pitch
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

function generateSemiFinals(age) {
  const groupA = tournamentData[age].fixtures.filter(fixture => fixture.group === "Group A");
  const groupB = tournamentData[age].fixtures.filter(fixture => fixture.group === "Group B");

  // Get top 2 teams from each group (based on points, goal difference)
  const groupATop2 = getTop2Teams(groupA, age);
  const groupBTop2 = getTop2Teams(groupB, age);

  // Create semi-final fixtures
  const semiFinals = [
    { team1: groupATop2[0], team2: groupBTop2[1] },
    { team1: groupBTop2[0], team2: groupATop2[1] }
  ];

  return semiFinals;
}

function getTop2Teams(groupFixtures, age) {
  const results = tournamentData[age].results || [];

  // Calculate points, goal difference, etc. (or use an existing league table logic)
  const stats = {};
  groupFixtures.forEach(fixture => {
    const result = results.find(result =>
      result.team1 === fixture.team1 && result.team2 === fixture.team2
    );

    if (!result) return;

    if (!stats[fixture.team1]) stats[fixture.team1] = { points: 0, goalDifference: 0 };
    if (!stats[fixture.team2]) stats[fixture.team2] = { points: 0, goalDifference: 0 };

    // Update points and goal difference based on the result
    if (result.team1Score > result.team2Score) {
      stats[fixture.team1].points += 3;
    } else if (result.team2Score > result.team1Score) {
      stats[fixture.team2].points += 3;
    } else {
      stats[fixture.team1].points += 1;
      stats[fixture.team2].points += 1;
    }

    stats[fixture.team1].goalDifference += result.team1Score - result.team2Score;
    stats[fixture.team2].goalDifference += result.team2Score - result.team1Score;
  });

  // Sort teams by points, goal difference, and then goals scored
  const sortedTeams = Object.keys(stats).sort((a, b) => {
    const teamA = stats[a];
    const teamB = stats[b];

    if (teamA.points !== teamB.points) return teamB.points - teamA.points;
    return teamB.goalDifference - teamA.goalDifference;
  });

  return sortedTeams.slice(0, 2);
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
  const selectedGroup = groupSelect.value;

  const fixtures = tournamentData[age].fixtures || [];

const results = (tournamentData[age].results || []).filter(result => {
  if (selectedGroup === "all") return true;

  const matchingFixture = fixtures.find(fixture =>
    fixture.team1 === result.team1 &&
    fixture.team2 === result.team2 &&
    fixture.time === result.time &&
    fixture.pitch === result.pitch
  );

  return matchingFixture?.group === selectedGroup;
});

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

  const knockoutDiv = document.getElementById("knockout-display");
  if (knockoutDiv) {
    knockoutDiv.innerHTML = "Knockout stages will appear once group games are complete.";
  }

  return;
}

  renderLeagueTable(age);
  renderResults(age);
  renderFixtures(age);
  renderSemiFinals(age);
}

function renderSemiFinals(age) {
  const knockoutDiv = document.getElementById("knockout-display");
  const results = tournamentData[age].results || [];
  const fixtures = tournamentData[age].fixtures || [];

  knockoutDiv.innerHTML = "";

// NEW — detects number of groups dynamically
const uniqueGroups = [...new Set(fixtures.map(f => f.group).filter(Boolean))];

if (uniqueGroups.length === 0) {
  knockoutDiv.innerHTML = "Knockout stages will appear once group games are complete.";
  return;
}

  const allGroupResultsComplete = fixtures.every(fixture =>
    results.some(result =>
      result.team1 === fixture.team1 &&
      result.team2 === fixture.team2 &&
      result.time === fixture.time &&
      result.pitch === fixture.pitch
    )
  );

  if (!allGroupResultsComplete) {
    knockoutDiv.innerHTML = "Knockout stages will appear once all group games are complete.";
    return;
  }

  // Use existing admin logic to derive standings
  const calcStandings = (groupFixtures) => {
    const table = {};
    groupFixtures.forEach(f => {
      if (!table[f.team1]) table[f.team1] = { team: f.team1, points: 0, gd: 0, gf: 0 };
      if (!table[f.team2]) table[f.team2] = { team: f.team2, points: 0, gd: 0, gf: 0 };
    });
    results.forEach(r => {
      const match = groupFixtures.find(f =>
        f.team1 === r.team1 && f.team2 === r.team2 &&
        f.time === r.time && f.pitch === r.pitch
      );
      if (!match) return;
      const s1 = r.team1Score, s2 = r.team2Score;
      table[r.team1].gf += s1; table[r.team1].gd += s1 - s2;
      table[r.team2].gf += s2; table[r.team2].gd += s2 - s1;
      if (s1 > s2) { table[r.team1].points += 3; }
      else if (s2 > s1) { table[r.team2].points += 3; }
      else { table[r.team1].points += 1; table[r.team2].points += 1; }
    });
    return Object.values(table).sort((a, b) =>
      b.points - a.points || b.gd - a.gd || b.gf - a.gf
    );
  };

  // Derive seeding based on how many groups exist
  let sf1Team1, sf1Team2, sf2Team1, sf2Team2;

  if (uniqueGroups.length === 1) {
    // Single group: top 4 qualify — 1st vs 4th, 2nd vs 3rd
    const standings = calcStandings(fixtures.filter(f => f.group === uniqueGroups[0]));
    sf1Team1 = standings[0]?.team || "TBD";
    sf1Team2 = standings[3]?.team || "TBD";
    sf2Team1 = standings[1]?.team || "TBD";
    sf2Team2 = standings[2]?.team || "TBD";
  } else {
    // Two groups: A1 vs B2, B1 vs A2
    const groupAStandings = calcStandings(fixtures.filter(f => f.group === "Group A"));
    const groupBStandings = calcStandings(fixtures.filter(f => f.group === "Group B"));
    sf1Team1 = groupAStandings[0]?.team || "TBD";
    sf1Team2 = groupBStandings[1]?.team || "TBD";
    sf2Team1 = groupBStandings[0]?.team || "TBD";
    sf2Team2 = groupAStandings[1]?.team || "TBD";
  }

  const knockoutResults = results.filter(r => r.type === "knockout");
  const semiFinal1 = knockoutResults.find(r => r.stage === "Semi Final 1");
  const semiFinal2 = knockoutResults.find(r => r.stage === "Semi Final 2");
  const final = knockoutResults.find(r => r.stage === "Final");

  const getWinner = (match) => {
    if (!match) return null;
    return match.team1Score > match.team2Score ? match.team1 : match.team2;
  };

  const createMatch = (title, team1, team2, result, isFinal = false) => {
    if (!result) {
      return `
        <div class="knockout-match ${isFinal ? 'final-match' : ''}">
          <strong>${title}</strong><br/>
          <span>${team1}</span> vs <span>${team2}</span>
        </div>`;
    }
    const winner = getWinner(result);
    return `
      <div class="knockout-match ${isFinal ? 'final-match' : ''}">
        <strong>${title}</strong><br/>
        <span class="${winner === result.team1 ? 'winner' : ''}">${result.team1}</span>
        ${result.team1Score} - ${result.team2Score}
        <span class="${winner === result.team2 ? 'winner' : ''}">${result.team2}</span>
      </div>`;
  };

  const finalWinner = getWinner(final);
  const finalTeam1 = semiFinal1 ? getWinner(semiFinal1) : "SF1 Winner";
  const finalTeam2 = semiFinal2 ? getWinner(semiFinal2) : "SF2 Winner";

  knockoutDiv.innerHTML = `
    ${createMatch("Semi Final 1", sf1Team1, sf1Team2, semiFinal1)}
    ${createMatch("Semi Final 2", sf2Team1, sf2Team2, semiFinal2)}
    ${createMatch("Final", finalTeam1, finalTeam2, final, true)}
    ${finalWinner ? `<div class="winner-banner">🏆 Will Brazier Festival of Football Champions!: ${finalWinner}</div>` : ''}
  `;
}



// ===== Event Listeners =====

ageGroupSelect.addEventListener('change', async () => {
  listenToSelectedDataFromFirebase();
});

document.getElementById("day-select").addEventListener("change", async () => {
  listenToSelectedDataFromFirebase();
});

document.getElementById("session-select").addEventListener("change", async () => {
  listenToSelectedDataFromFirebase();
});

groupSelect.addEventListener("change", () => {
  const selectedAge = ageGroupSelect.value;
  refreshAll(selectedAge);
});


// ===== Initial Load =====

document.addEventListener('DOMContentLoaded', () => {
  const initialAge = ageGroupSelect.value;

  listenToSelectedDataFromFirebase();
});
