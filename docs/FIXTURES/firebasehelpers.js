import { database } from './firebase.js';
import { ref, set, get } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";

// Save fixtures for an age group
export async function saveFixtures(ageGroup, fixturesData) {
  const fixturesRef = ref(database, `tournamentData/${ageGroup}/fixtures`);
  await set(fixturesRef, fixturesData);
}

// Load fixtures for an age group
export async function loadFixtures(ageGroup) {
  const fixturesRef = ref(database, `tournamentData/${ageGroup}/fixtures`);
  const snapshot = await get(fixturesRef);
  return snapshot.exists() ? snapshot.val() : null;
}

// Save results for an age group
export async function saveResults(ageGroup, resultsData) {
  const resultsRef = ref(database, `tournamentData/${ageGroup}/results`);
  await set(resultsRef, resultsData);
}

// Load results for an age group
export async function loadResults(ageGroup) {
  const resultsRef = ref(database, `tournamentData/${ageGroup}/results`);
  const snapshot = await get(resultsRef);
  return snapshot.exists() ? snapshot.val() : null;
}

// Save teams for an age group
export async function saveTeams(ageGroup, teams) {
  const teamsRef = ref(database, `tournamentData/${ageGroup}/teams`);
  await set(teamsRef, teams);
}

// ... your existing code ...

// Load teams for an age group
export async function loadTeams(ageGroup) {
  const teamsRef = ref(database, `tournamentData/${ageGroup}/teams`);
  const snapshot = await get(teamsRef);
  return snapshot.exists() ? snapshot.val() : null;
}
