import moment from "moment";

const getAuthToken = async () => {
    // Check localStorage for existing token
    let token = localStorage.getItem('authToken');
    if (token) {
      // Check token expiration (optional, see explanation below)
        const expirationTime = localStorage.getItem('authTokenExpiration');
        if (expirationTime && Date.now() > expirationTime) {
            console.warn('Token expired, fetching new one');
            chrome.identity.removeCachedAuthToken({ token: token });
            token = null; // Clear invalid token
        } else {
            // console.log('Using existing token from localStorage');
            // console.log(token)
            return token; // Return valid token if not expired
        }
    }

    // Request new token if necessary (interactive or non-interactive)
    let newToken;
    try {
        newToken = await chrome.identity.getAuthToken({ 'interactive': true });
        // console.log(`obtained new token ${newToken}`);
    } catch (error) {
        console.error('Failed to obtain token:', error);
        return null;
    }   

    token = newToken.token;
    // console.log(newToken)
    localStorage.setItem('authToken', token);

    // Set expiration time (optional)
    const expiresIn = 1800 // Access expiration details if available

    const expiration = Date.now() + expiresIn * 1000; // Convert seconds to milliseconds
    localStorage.setItem('authTokenExpiration', expiration.toString());

    return token;
};


const createCalendar = async (calendarName, headers) => {
    let res = await fetch('https://www.googleapis.com/calendar/v3/calendars', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
            summary: calendarName
        })
    });
    if (!res.ok) {
        console.error('Failed to create calendar:', res.status);
        throw new Error('Failed to create calendar');
    }

    return await res.json();
}

const createSchedule = async (event) => {
    event.preventDefault();
    const token = await getAuthToken();
    if (!token) {
        console.error('Failed to obtain token');
        return;
    }

    const calendarName = document.getElementById("textin").value;
    
    let headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    let data;
    try {
        data = await createCalendar(calendarName, headers);
    } catch (error) {
        console.error(error);
        displayMessage(error, 'red');
        return;
    }
    // console.log(data);

    const tableData = await retrieveTableData();
    console.log(tableData);


    try {
        let promises = Object.values(tableData).map((eventData, index) => insertEvent(data.id, headers, eventData, index % 11 + 1))
        // .map(eventData => insertEvent(data.id, headers, eventData, colors));
        let results = await Promise.all(promises);
        // console.log(results);
        displayMessage('Schedule created successfully', 'green');

    } catch (error) {
        console.error(error);
        displayMessage(error, 'red');
        return;
    }
}



const insertEvent = async (calendarName, headers, eventData, colorId) => {
    
    const dayMapping = {
        'Monday': 'MO',
        'Tuesday': 'TU',
        'Wednesday': 'WE',
        'Thursday': 'TH',
        'Friday': 'FR',
        'Saturday': 'SA',
        'Sunday': 'SU'
    };

    let formattedDays = eventData.day.map(day => dayMapping[day]).join(',');
    let startTime = moment(eventData.startTime, "dddd h:mm a").toISOString();
    let endTime = moment(eventData.endTime, "dddd h:mm a").toISOString();
    const body = {
        summary: eventData.course,
        location: eventData.location,
        start: {
            dateTime: startTime,
            timeZone: 'Asia/Dubai'
        },
        end: {
            dateTime: endTime,
            timeZone: 'Asia/Dubai'
        },
        colorId: colorId,
        recurrence: [
            'RRULE:FREQ=WEEKLY;BYDAY=' + formattedDays
        ]
    };

    let res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarName}/events`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        console.error('Failed to insert event:', res.status);
        throw new Error('Failed to insert event');
    }

    return await res.json();

}


const retrieveTableData = async () =>  {
    
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    const response = await chrome.tabs.sendMessage(tab.id, { message: 'retrieve_table_data' });
    
    // console.log('response', response)
    if (!response.elems) {
        console.error('Failed to retrieve table data');
        return;
    }

    return response.elems
}


// create a function that displays the error on the DOM
const displayMessage = (message, color) => {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = message;
    messageDiv.style.display = 'block';
    messageDiv.style.color = color;
    messageDiv.style.fontWeight = 'bold';
    messageDiv.style.border = '3px solid';
    messageDiv.style.borderRadius = '10px';
    messageDiv.style.borderColor = color;
    messageDiv.style.padding = '5px';
    messageDiv.style.fontSize = '10pt';
    
    setTimeout(() => {
        messageDiv.textContent = '';
        messageDiv.style.display = 'none';
    }, 3000);

}

document.getElementById('form').onsubmit = createSchedule;