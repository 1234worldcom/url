document.addEventListener('DOMContentLoaded', () => {
  const shortenForm = document.getElementById('shorten-form');
  const loginForm = document.getElementById('login-form');
  const loginButton = document.getElementById('login-button');
  const logoutButton = document.getElementById('logout-button');
  const shortenedUrlElement = document.getElementById('shortened-url');
  const errorMessageElement = document.getElementById('error-message');
  const qrCodeImage = document.getElementById('qrCodeImage');
  const customShortUrlInput = document.getElementById('customShortUrl');

  // Function to check if the user is logged in (you should implement this logic)
  function isLoggedIn() {
    return localStorage.getItem('isLoggedIn') === 'true';
  }

  // Function to show or hide the custom short URL input field based on login status
  function toggleCustomShortUrlField() {
    const userIsLoggedIn = isLoggedIn();
    customShortUrlInput.disabled = !userIsLoggedIn;
    customShortUrlInput.value = ''; // Clear the input value if it was previously set
  }

  // Check login status when the page loads and adjust the form accordingly
  toggleCustomShortUrlField();

  // Add event listener for form submission
  shortenForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const apiUrl = 'https://shortenurl-a0ji.onrender.com/api/shorten'; // Define your API URL here
    const originalUrl = document.getElementById('originalUrl').value;
    const customShortUrl = document.getElementById('customShortUrl').value;

    try {
      // Send a POST request to your server to shorten the URL
      const response = await fetch(apiUrl, {
        method: 'POST',
        mode: 'cors', // Set the mode to 'cors' to handle CORS
        headers: {
          'Content-Type': 'application/json',
          'Origin': '127.0.0.1:5501' // Specify your origin here
        },
        body: JSON.stringify({
          originalUrl,
          customShortUrl,
        }),
      });[]

      const data = await response.json();

      if (response.ok) {
        // Store login status in local storage
        localStorage.setItem('isLoggedIn', 'true');

        shortenedUrlElement.textContent = `Shortened URL: ${data.shortenedUrl}`;
        errorMessageElement.textContent = '';

        // Handle the QR code URL from the server response
        let qrCodeUrl = 'https://shortenurl-a0ji.onrender.com/' + data.shortenedUrl;

        if (qrCodeUrl && qrCodeUrl !== 'None') {
          if (!qrCodeUrl.startsWith('https://') && !qrCodeUrl.startsWith('https://')) {
            qrCodeUrl = `https://${qrCodeUrl}`;
          }

          const qrCodeImageUrl = `${qrCodeUrl}/qrcode`;

          qrCodeImage.src = qrCodeImageUrl;
        } else {
          qrCodeImage.src = '';
        }
      } else {
        errorMessageElement.textContent = data.error || 'An error occurred.';
        shortenedUrlElement.textContent = '';
        qrCodeImage.src = '';
      }
    } catch (error) {
      errorMessageElement.textContent = 'An error occurred. Please try again later.';
      shortenedUrlElement.textContent = '';
      qrCodeImage.src = '';
    }
  });

  // Add event listener for the login button (you should customize this logic)
  loginButton.addEventListener('click', () => {
    // Implement your login logic here
    // After successful login, set the user as logged in
    localStorage.setItem('isLoggedIn', 'true');
    toggleCustomShortUrlField();
  });

  // Add event listener for the logout button (you should customize this logic)
  logoutButton.addEventListener('click', () => {
    // Implement your logout logic here
    // After logout, set the user as not logged in
    localStorage.setItem('isLoggedIn', 'false');
    toggleCustomShortUrlField();
  });
});

// Function to copy the shortened URL to clipboard
function copyToClipboard() {
  const shortenedUrlElement = document.getElementById('shortened-url');
  if (shortenedUrlElement) {
    const text = shortenedUrlElement.textContent;
    if (text) {
      const url = text.replace('Shortened URL: ', '').trim();
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Link copied to clipboard!');
    } else {
      alert('No link generated.'); // Show error alert when no link is generated
    }
  }
}
