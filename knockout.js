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

// Function to declare the winner and trigger confetti animation
function celebrate(ageGroup) {
  // Get the winner's name from the first team-input field in the final
  const winnerInputs = document.querySelectorAll(`#${ageGroup}-final .match input.team-input`);
  const winnerName = winnerInputs[0]?.value.trim() || "Unknown Team";

  // Update and show the winner banner
  const winnerBanner = document.querySelector(`#${ageGroup}-winner-banner`);
  const winnerNameElement = document.querySelector(`#${ageGroup}-winner-name`);
  winnerNameElement.textContent = winnerName;
  winnerBanner.style.display = 'block';

  // Start confetti animation
  startConfetti();

  // Disable all inputs in the final
  const inputs = document.querySelectorAll(`#${ageGroup}-final input`);
  inputs.forEach(input => input.disabled = true);

  // Disable the declare winner button for this age group
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


