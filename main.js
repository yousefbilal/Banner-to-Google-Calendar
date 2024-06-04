chrome.identity.getAuthToken({ 'interactive': true}, token => {
    console.log(token)
    
    const headers = new Headers({
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
    })


    const queryParams = { headers };
    console.log(queryParams)

    fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', queryParams)
        .then( res => res.json())
        .then( data => {
            console.log(data)
        })
})