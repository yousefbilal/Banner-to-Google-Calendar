
const childIndex = (childNode) => {
    const [...children] =  childNode.parentNode.children;
    return children.length > 7 ? children.indexOf(childNode) - 1 : children.indexOf(childNode);
}


const processElement = elem => {
    let [course, crn, time, location] = elem.innerText.split('\n');
    let [startTime, endTime] = time.split('-');
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const day = days[childIndex(elem)];
    startTime = `${day} ${startTime}`;
    endTime = `${day} ${endTime}`;

    crn = crn.split(' ')[0];
    
    return {
        course,
        crn,
        startTime,
        endTime,
        location,
        day: [day]
    
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // console.log('content_script.js received message');
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    // console.log(request);
    if (request.message === 'retrieve_table_data') {

        let [...elems] = window.frames[1].document.querySelectorAll('td.ddlabel');
        elems = elems.map(elem => processElement(elem));
        elems = elems.reduce((acc, elem) => {
            let key = elem.crn;
            if (acc[key])
                acc[key].day.push(elem.day[0]);
            else 
                acc[key] = elem;
            return acc;
        }, {});

        console.log('elems', elems);
        sendResponse({ elems: elems });
    } else {
        sendResponse({elems: {}});
    }
});
