import moment from "moment-timezone";

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
            console.log('Using existing token from localStorage');
            console.log(token)
            return token; // Return valid token if not expired
        }
    }

    // Request new token if necessary (interactive or non-interactive)
    let newToken;
    try {
        newToken = await chrome.identity.getAuthToken({ 'interactive': true });
        console.log(`obtained new token ${newToken}`);
    } catch (error) {
        console.error('Failed to obtain token:', error);
        return null;
    }   

    token = newToken.token;
    console.log(newToken)
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

const createSchedule = async () => {
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
        return;
    }
    console.log(data);

    const tableData = await retrieveTableData();
    console.log(tableData);

    const colors = {
        colorCounter: 0,
        colorMap: {}
    }
    try {
        let promises = tableData.map(eventData => insertEvent(data.id, headers, eventData, colors));
        let results = await Promise.all(promises);
        console.log(results);
    } catch (error) {
        console.error(error);
        return;
    }
}



const insertEvent = async (calendarName, headers, eventData, colors) => {
    const { elem: eventInfo, day } = eventData;
    let crn = eventInfo[1].split(' ')[0];

    let [startTime, endTime] = eventInfo[2].split('-'); 
    startTime = `${day} ${startTime}`;
    endTime = `${day} ${endTime}`;

    startTime = moment(startTime, "dddd h:mm a").tz("Asia/Dubai").format();
    endTime = moment(endTime, "dddd h:mm a").tz("Asia/Dubai").format();

    colors.colorMap[crn] = colors.colorMap[crn] || colors.colorCounter++;

    const body = {
        summary: eventInfo[0],
        location: eventInfo[3],
        start: {
            dateTime: startTime,
            timeZone: 'Asia/Dubai'
        },
        end: {
            dateTime: endTime,
            timeZone: 'Asia/Dubai'
        },
        colorId: colors.colorMap[crn],
        recurrence: [
            'RRULE:FREQ=WEEKLY'
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
    
    console.log('response', response)
    if (!response) {
        console.error('Failed to retrieve table data');
        return;
    }

    return response.elems.map(elem => elem.split('\n'));
}

document.getElementById('authorize_button').onclick = createSchedule;