const getAuthToken = async () => {
    // Check localStorage for existing token
    let token = localStorage.getItem('authToken');
    if (token) {
      // Check token expiration (optional, see explanation below)
        const expirationTime = localStorage.getItem('authTokenExpiration');
        if (expirationTime && Date.now() > expirationTime) {
            console.warn('Token expired, fetching new one');
            token = null; // Clear invalid token
        } else {
            console.log('Using existing token from localStorage');
            return token; // Return valid token if not expired
        }
    }

    // Request new token if necessary (interactive or non-interactive)
    try {
        const { token: newToken } = await chrome.identity.getAuthToken({ 'interactive': true });
        console.log(`obtained new token ${newToken}`);
    } catch (error) {
        console.error('Failed to obtain token:', error);
        return null;
    }   

    token = newToken;
    localStorage.setItem('authToken', token);

    // Set expiration time (optional)
    const expiresIn = chrome.identity.getAuthToken.details?.expiresIn; // Access expiration details if available
    if (expiresIn) {
        const expiration = Date.now() + expiresIn * 1000; // Convert seconds to milliseconds
        localStorage.setItem('authTokenExpiration', expiration.toString());
    } else {
        console.warn('Token expiration information unavailable');
    }

    return token;
};

document.getElementById('authorize_button').onclick = getAuthToken