const express = require('express');
const bodyParser = require('body-parser');
const qrcode = require('qrcode');
const { encode } = require('base62');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const cors = require('cors');


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public'));

const urlDatabase = {};
let idCounter = 1;

// Function to generate a 5-letter encoded short URL
function generateShortUrl() {
    return encode(idCounter++, { characters: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz' }).slice(0, 5);
}
 
const corsOptions = {
    origin: 'http://127.0.0.1:5501', // Specify the allowed origin
    credentials: true, // Indicate that cookies should be included in cross-site requests
};

app.use(cors(corsOptions));
 
  // Define a new route to serve usage data and URL list
app.get('/api/usage', (req, res) => {
    // Calculate the total number of URLs in the database
    const totalUrls = Object.keys(urlDatabase).length;
  
    // Create an array to store URL list data
    const urlList = [];
  
    // Iterate through the URL database and gather URL list information
    for (const shortUrl in urlDatabase) {
      if (urlDatabase.hasOwnProperty(shortUrl)) {
        const { originalUrl, usageCount } = urlDatabase[shortUrl];
        urlList.push({
          shortUrl,
          originalUrl,
          usageCount,
        });
      }
    }
  
    // Usage data and URL list data combined in the response
    const responseData = {
      totalUrls,
      urlList,
    };
  
    res.json(responseData);
  });
  
// User tracking by IP address and daily URL count
const userTracking = {};

// Serve the dynamic dashboard
app.get('/dashboard', (req, res) => {
    // Read the dashboard.html file
    fs.readFile('public/dashboard.html', 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error reading dashboard.html');
        } else {
            res.send(data);
        }
    });
});




// Create Short URL with Custom Short Link and Timestamp
app.post('/api/shorten', async (req, res) => {
    const { originalUrl, customShortUrl } = req.body;
    const userIp = req.ip;

    // Check if the user has reached the daily limit (5 URLs)
    if (!userTracking[userIp]) {
        userTracking[userIp] = [];
    }

    if (userTracking[userIp].length >= 5) {
        return res.status(400).json({ error: 'Daily limit exceeded. You can only create 5 URLs per day.' });
    }

    let shortUrl;

    if (customShortUrl) {
        // Check if custom short URL already exists
        if (urlDatabase.hasOwnProperty(customShortUrl)) {
            return res.status(400).json({ error: 'Custom short URL already in use' });
        }
        shortUrl = customShortUrl;
    } else {
        // Generate a new 5-letter short URL using base62 encoding
        shortUrl = generateShortUrl();
    }

    const urlData = {
        originalUrl,
        createdAt: new Date(),
        usageCount: 0,
        createdBy: userIp, // Track the user who created the URL
    };

    urlDatabase[shortUrl] = urlData;
    userTracking[userIp].push(shortUrl); // Track URL creation for the user

    // Emit a 'urlCreated' event with the new URL data
    io.emit('urlCreated', urlData);

    res.json({
        originalUrl,
        shortenedUrl: `http://localhost:3000/${shortUrl}`,
        customShortUrl: customShortUrl || 'None',
    });
});

// Resolve Short URL
app.get('/:shortUrl', async (req, res) => {
    const { shortUrl } = req.params;

    // Check if shortUrl exists in your database
    if (urlDatabase.hasOwnProperty(shortUrl)) {
        const { originalUrl } = urlDatabase[shortUrl];

        urlDatabase[shortUrl].usageCount++; // Update usage count
        return res.redirect(originalUrl); // Redirect to the original URL
    }

    // If shortUrl is not found, return a "Not Found" error
    return res.status(404).send(`<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>404 Error - Page Not Found</title>
        <!-- Include Bootstrap CSS -->
        <link href="https://maxcdn.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css" rel="stylesheet">
        <!-- Custom CSS for your 404 error page -->
        <style>
            body {
                background-color: #f8f9fa;
            }
    
            .error-container {
                text-align: center;
                padding: 100px 0;
            }
    
            .error-heading {
                font-size: 72px;
                color: #343a40;
            }
    
            .error-message {
                font-size: 24px;
                color: #6c757d;
            }
    
            .back-button {
                margin-top: 20px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="error-container">
                <h1 class="error-heading">404</h1>
                <p class="error-message">Oops! The url you're looking for could not be found.</p>
                <a href="/" class="btn btn-primary back-button">Go Back to Home</a>
            </div>
        </div>
    
        <!-- Include Bootstrap JS (optional) -->
        <script src="https://maxcdn.bootstrapcdn.com/bootstrap/4.5.2/js/bootstrap.min.js"></script>
    </body>
    </html>`);
    });



// Route to handle QR code generation
app.get('/:shortUrl/qrcode', async (req, res) => {
    const { shortUrl } = req.params;

    if (shortUrl === 'None') {
        // Handle the case where the custom short URL is 'None'
        return res.status(404).se({ error: 'Short URL not found' });
    }

    if (urlDatabase.hasOwnProperty(shortUrl)) {
        const shortenedUrl = `http://localhost:3000/${shortUrl}`;

        // Generate QR code for the shortened URL
        try {
            const qrCodeData = await qrcode.toDataURL(shortenedUrl);
            res.type('png'); // Set the response content type to PNG image
            res.send(Buffer.from(qrCodeData.split(',')[1], 'base64')); // Send the QR code image data
        } catch (error) {
            console.error('QR code generation error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    } else {
        res.status(404).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Short URL Not Found</title>
            <!-- Include Bootstrap CSS or any other styling you prefer -->
            <style>
                body {
                    background-color: #f8f9fa;
                    font-family: Arial, sans-serif;
                    text-align: center;
                }

                .error-container {
                    padding: 100px 0;
                }

                .error-heading {
                    font-size: 72px;
                    color: #343a40;
                    margin-bottom: 20px;
                }

                .error-message {
                    font-size: 24px;
                    color: #6c757d;
                    margin-bottom: 40px;
                }

                /* Additional CSS for custom styling */
                .container {
                    max-width: 600px;
                    margin: 0 auto;
                }

                .btn-primary {
                    background-color: #007bff;
                    border-color: #007bff;
                }

                .btn-primary:hover {
                    background-color: #0056b3;
                    border-color: #0056b3;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="error-container">
                    <h1 class="error-heading">Short URL Not Found</h1>
                    <p class="error-message">Sorry, there is no QR code available for this short URL.</p>
                    <a href="/" class="btn btn-primary">Go Back to Home</a>
                </div>
            </div>
        </body>
        </html>
    `);

    }
});

// Get URLs created by the user
app.get('/api/urls/user/:userIp', (req, res) => {
    const { userIp } = req.params;
    const userUrls = Object.keys(urlDatabase)
        .filter(shortUrl => urlDatabase[shortUrl].createdBy === userIp)
        .map(shortUrl => ({
            shortUrl,
            originalUrl: urlDatabase[shortUrl].originalUrl,
            usageCount: urlDatabase[shortUrl].usageCount,
        }));
    res.json(userUrls);
});

setInterval(() => {
    const analyticsData = {
        totalUrls: Object.keys(urlDatabase).length,
        usageCounts: Object.values(urlDatabase).map((url) => url.usageCount),
    };
    io.emit('realtimeData', analyticsData);
}, 5000); // Emit data every 5 seconds

app.get('/api/urls/user/:userIp', (req, res) => {
  const { userIp } = req.params;
  const userUrls = Object.keys(urlDatabase)
    .filter(shortUrl => urlDatabase[shortUrl].createdBy === userIp)
    .map(shortUrl => ({
      shortUrl,
      originalUrl: urlDatabase[shortUrl].originalUrl,
      usageCount: urlDatabase[shortUrl].usageCount,
    }));
  res.json(userUrls);
});

app.use((req, res, next) => {
  const userIp = req.ip;
  req.userIp = userIp;
  next();
});

// Socket.io event listeners can be added here
// Fetch and send the URL list data
app.get('/api/urllist-data', (req, res) => {
    const urlData = Object.keys(urlDatabase).map((shortUrl) => {
        const { originalUrl, createdAt } = urlDatabase[shortUrl];
        return {
            shortUrl, // Include the short URL in the response
            originalUrl,
            createdAt,
        };
    });

    // Send the URL list data as JSON
    res.json(urlData);
});

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); // Replace '*' with the allowed origin(s) if needed
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', true);
  
    if (req.method === 'OPTIONS') {
      // Respond to preflight requests
      return res.sendStatus(200);
    }
  
    next();
  });
   

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
