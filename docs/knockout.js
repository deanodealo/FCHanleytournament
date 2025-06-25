// Flag to keep track of whether confetti is active
let confettiInterval;

// Function to trigger the confetti animation
function startConfetti() {
  confettiInterval = setInterval(() => {
    confetti({
      particleCount: 80,
      spread: 125,
      origin: { y: 0.2 } // Higher on the screen so it's visible
    });
  }, 100); // Confetti will be generated every 100ms
}

// Function to stop the confetti animation
function stopConfetti() {
  clearInterval(confettiInterval);
}

function celebrate(ageGroup) {
  // Get the final match inputs
  const finalMatch = document.querySelector(`#${ageGroup}-final .match`);
  const teamInputs = finalMatch.querySelectorAll('input.team-input');
  const scoreInputs = finalMatch.querySelectorAll('input.score-input');

  if (teamInputs.length < 2 || scoreInputs.length < 2) {
    alert("Missing team or score inputs.");
    return;
  }

  const team1Name = teamInputs[0].value.trim();
  const team2Name = teamInputs[1].value.trim();
  const score1 = parseInt(scoreInputs[0].value.trim(), 10);
  const score2 = parseInt(scoreInputs[1].value.trim(), 10);

  let winnerName = "Unknown Team";

  if (!isNaN(score1) && !isNaN(score2)) {
    if (score1 > score2) {
      winnerName = team1Name;
    } else if (score2 > score1) {
      winnerName = team2Name;
    } else {
      winnerName = "It's a draw!";
    }
  }

  // Update and show the winner banner
  const winnerBanner = document.querySelector(`#${ageGroup}-winner-banner`);
  const winnerNameElement = document.querySelector(`#${ageGroup}-winner-name`);
  winnerNameElement.textContent = winnerName;
  winnerBanner.style.display = 'block';

  // Start confetti animation
  startConfetti();

  // Disable inputs
  const inputs = document.querySelectorAll(`#${ageGroup}-final input`);
  inputs.forEach(input => input.disabled = true);

  // Disable the declare winner button
  const declareWinnerButton = document.querySelector(`#${ageGroup}-final .declare-winner-btn`);
  declareWinnerButton.disabled = true;
  declareWinnerButton.style.backgroundColor = '#d3d3d3';
  declareWinnerButton.style.cursor = 'not-allowed';
}


// Event listener for all "Declare Winner" buttons
document.querySelectorAll('.declare-winner-btn').forEach(button => {
  button.addEventListener('click', (event) => {
    const ageGroup = event.target.closest('.stage').id.split('-')[0]; // Get the ID prefix like "u7"
    celebrate(ageGroup);
  });
});

// Event listener for the "Stop Confetti" button
document.querySelector('#stop-confetti-btn').addEventListener('click', stopConfetti);


