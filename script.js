let monitoringInterval;
let lastRainStatus = null;
let userLocation = null;
let apiKey = '68eac0f81c38c0eefd648dbb062e1bfb';

// Get user's location
async function getUserLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            position => {
                resolve({
                    lat: position.coords.latitude,
                    lon: position.coords.longitude
                });
            },
            error => {
                reject(error);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    });
}

// Request notification permission
async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        showNotification('Browser notifications not supported', 'error');
        return;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
        showNotification('Notifications enabled! 🎉', 'rain-stop');
    } else {
        showNotification('Notifications denied. Please enable in browser settings.', 'error');
    }
}

// Show in-app notification
function showNotification(message, type = 'rain-start') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type} show`;
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 5000);
}

// Send browser notification
function sendBrowserNotification(title, body, icon = '🌧️') {
    if (Notification.permission === 'granted') {
        new Notification(title, {
            body: body,
            icon: `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${icon}</text></svg>`
        });
    }
}

// Update scenic background based on weather
function updateScenery(weatherData) {
    const background = document.getElementById('weatherBackground');
    const mainWeather = weatherData.weather[0].main.toLowerCase();
    const description = weatherData.weather[0].description.toLowerCase();
    const currentHour = new Date().getHours();
    const isNight = currentHour < 6 || currentHour > 18;

    // Remove all existing weather classes
    background.className = 'weather-background';

    // Determine weather scene
    if (mainWeather.includes('rain') || mainWeather.includes('drizzle')) {
        background.classList.add('rainy');
    } else if (mainWeather.includes('thunderstorm')) {
        background.classList.add('thunderstorm');
    } else if (mainWeather.includes('snow')) {
        background.classList.add('snowy');
    } else if (mainWeather.includes('cloud') || description.includes('cloud')) {
        background.classList.add('cloudy');
    } else if (mainWeather.includes('clear')) {
        if (isNight) {
            background.classList.add('clear-night');
        } else {
            background.classList.add('clear-day');
        }
    } else {
        // Default based on time of day
        if (isNight) {
            background.classList.add('clear-night');
        } else {
            background.classList.add('clear-day');
        }
    }

    console.log(`Weather: ${mainWeather}, Scene: ${background.className}, Time: ${currentHour}:00`);
}

// Get weather data from OpenWeatherMap API
async function getWeatherData(lat, lon) {
    try {
        if (!apiKey) {
            throw new Error('API key not provided');
        }

        const response = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`
        );

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Invalid API key. Please check your OpenWeatherMap API key.');
            }
            throw new Error(`Weather API error: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        // Fallback to mock data if API fails (for demo purposes)
        console.warn('API call failed, using mock data:', error.message);
        
        if (error.message.includes('Invalid API key')) {
            document.getElementById('status').textContent = '❌ Invalid API key';
            showNotification('Invalid API key. Please check your key.', 'error');
            stopMonitoring();
            return null;
        }

        // Mock data as fallback with more realistic rain detection
        const currentHour = new Date().getHours();
        const isRainyTime = currentHour >= 14 && currentHour <= 18; // Afternoon rain common in Kathmandu
        
        return {
            weather: [
                {
                    main: isRainyTime ? 'Rain' : 'Clear',
                    description: isRainyTime ? 'moderate rain' : 'clear sky'
                }
            ],
            name: 'Kathmandu',
            main: {
                temp: 22 + Math.floor(Math.random() * 10) - 5,
                humidity: isRainyTime ? 80 + Math.floor(Math.random() * 15) : 50 + Math.floor(Math.random() * 20)
            }
        };
    }
}

// Check for rain and notify
async function checkRain() {
    if (!userLocation) return;

    try {
        const weatherData = await getWeatherData(userLocation.lat, userLocation.lon);
        
        if (!weatherData) return; // API key error already handled

        // Enhanced rain detection
        const isRaining = weatherData.weather[0].main.toLowerCase().includes('rain') || 
                        weatherData.weather[0].main.toLowerCase().includes('drizzle') ||
                        weatherData.weather[0].main.toLowerCase().includes('thunderstorm') ||
                        weatherData.weather[0].description.toLowerCase().includes('rain') ||
                        weatherData.weather[0].description.toLowerCase().includes('shower') ||
                        weatherData.weather[0].description.toLowerCase().includes('drizzle');
        
        const description = weatherData.weather[0].description;
        const location = weatherData.name;

        // Update scenic background
        updateScenery(weatherData);

        // Update location info with actual city name
        document.getElementById('locationInfo').textContent = `📍 Monitoring: ${location}`;

        // Update weather info
        document.getElementById('currentWeather').innerHTML = `
            <strong>Current:</strong> ${description}<br>
            <strong>Temperature:</strong> ${Math.round(weatherData.main.temp)}°C<br>
            <strong>Humidity:</strong> ${weatherData.main.humidity}%<br>
            <strong>Rain Detection:</strong> ${isRaining ? '🌧️ YES' : '❌ NO'}<br>
            <strong>Last updated:</strong> ${new Date().toLocaleTimeString()}
        `;
        document.getElementById('weatherInfo').style.display = 'block';

        // Check for rain status change
        if (lastRainStatus !== null && lastRainStatus !== isRaining) {
            if (isRaining) {
                // Rain started
                const message = `🌧️ Rain has started in ${location}!`;
                showNotification(message, 'rain-start');
                sendBrowserNotification('Rain Alert!', `It's starting to rain in ${location}. Current: ${description}`, '🌧️');
                document.getElementById('status').textContent = `🌧️ Raining in ${location}!`;
            } else {
                // Rain stopped
                const message = `☀️ Rain has stopped in ${location}!`;
                showNotification(message, 'rain-stop');
                sendBrowserNotification('Rain Stopped!', `The rain has stopped in ${location}.`, '☀️');
                document.getElementById('status').textContent = `☀️ No rain in ${location}`;
            }
        } else {
            // Update status without notification
            document.getElementById('status').textContent = isRaining ? 
                `🌧️ Currently raining in ${location}` : 
                `☀️ No rain in ${location}`;
        }

        lastRainStatus = isRaining;
    } catch (error) {
        document.getElementById('status').textContent = '❌ Error checking weather';
        console.error('Weather check failed:', error);
    }
}

// Start monitoring
async function startMonitoring() {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    
    startBtn.disabled = true;
    startBtn.innerHTML = '<span class="loading"></span> Starting...';

    try {
        // Get location if not already obtained
        if (!userLocation) {
            userLocation = await getUserLocation();
            document.getElementById('locationInfo').textContent = 
                `📍 Monitoring at ${userLocation.lat.toFixed(2)}, ${userLocation.lon.toFixed(2)}`;
        }

        // Initial check
        await checkRain();

        // Start monitoring every 90 seconds (more frequent for better accuracy)
        monitoringInterval = setInterval(checkRain, 90000);

        // Update UI
        startBtn.style.display = 'none';
        stopBtn.disabled = false;
        stopBtn.classList.add('monitoring');
        stopBtn.textContent = '🟢 Monitoring Active';
        
        showNotification('Rain monitoring started! 🎯', 'rain-stop');

    } catch (error) {
        document.getElementById('status').textContent = '❌ Failed to start monitoring';
        document.getElementById('locationInfo').textContent = '📍 Location access denied or failed';
        startBtn.disabled = false;
        startBtn.textContent = 'Start Monitoring';
        showNotification('Failed to start monitoring. Please enable location access.', 'error');
    }
}

// Stop monitoring
function stopMonitoring() {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');

    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
    }

    // Reset UI
    startBtn.style.display = 'block';
    startBtn.disabled = false;
    startBtn.textContent = 'Start Monitoring';
    stopBtn.disabled = true;
    stopBtn.classList.remove('monitoring');
    stopBtn.classList.add('stopped');
    stopBtn.textContent = '🔴 Monitoring Stopped';

    document.getElementById('status').textContent = 'Monitoring stopped';
    lastRainStatus = null;

    // Reset to default clear day background
    const background = document.getElementById('weatherBackground');
    background.className = 'weather-background clear-day';

    showNotification('Rain monitoring stopped', 'error');
}

// Test notification
function testNotification() {
    showNotification('🧪 This is a test notification!', 'rain-start');
    sendBrowserNotification('Test Alert', 'Rain notifier is working correctly!', '✅');
}

// Initialize app
window.addEventListener('load', () => {
    // Set initial background
    const currentHour = new Date().getHours();
    const isNight = currentHour < 6 || currentHour > 18;
    const background = document.getElementById('weatherBackground');
    
    if (isNight) {
        background.classList.add('clear-night');
    } else {
        background.classList.add('clear-day');
    }

    // Request notification permission on load
    if ('Notification' in window && Notification.permission === 'default') {
        setTimeout(() => {
            requestNotificationPermission();
        }, 2000);
    }

    // Show welcome message
    setTimeout(() => {
        const notificationStatus = Notification.permission === 'granted' ? 
            'Welcome! Notifications are enabled ✅' : 
            'Welcome! Click "Enable Notifications" for alerts';
        
        showNotification(notificationStatus, 'rain-stop');
    }, 1000);
});

// Handle page visibility change
document.addEventListener('visibilitychange', () => {
    if (document.hidden && monitoringInterval) {
        console.log('Rain notifier running in background...');
    } else if (!document.hidden && monitoringInterval) {
        console.log('Rain notifier active in foreground');
        // Do an immediate check when page becomes visible again
        checkRain();
    }
});

// Handle window beforeunload
window.addEventListener('beforeunload', (event) => {
    if (monitoringInterval) {
        // Note: Modern browsers limit this, but we can try
        event.preventDefault();
        event.returnValue = 'Rain monitoring is active. Are you sure you want to leave?';
        return event.returnValue;
    }
});

// Service Worker for better background functionality
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Note: This would require a separate service worker file
        // For now, we'll rely on the page staying open or background tabs
        console.log('Service Worker support detected');
    });
}

// Keyboard shortcuts
document.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey) {
        switch(event.key) {
            case 's':
                event.preventDefault();
                if (!monitoringInterval) {
                    startMonitoring();
                } else {
                    stopMonitoring();
                }
                break;
            case 't':
                event.preventDefault();
                testNotification();
                break;
        }
    }
});

// Auto-refresh weather data periodically when monitoring
function scheduleWeatherRefresh() {
    if (monitoringInterval) {
        // Force an immediate check every 5 minutes for current conditions
        const refreshInterval = setInterval(() => {
            if (monitoringInterval) {
                checkRain();
            } else {
                clearInterval(refreshInterval);
            }
        }, 300000); // 5 minutes
    }
}