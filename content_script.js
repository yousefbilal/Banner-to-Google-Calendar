
const childIndex = (chileNode) => {
    const [...childeren] =  chileNode.parentNode.children
    return childeren.indexOf(chileNode);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('content_script.js received message');
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    console.log(request);
    if (request.message === 'retrieve_table_data') {
        let [...elems] = window.frames[1].document.querySelectorAll('td.ddlabel');
        elems = elems.map(elem => elem.innerText);
        console.log('elems', elems);
        elems = elems.map(elem => ({'elem': elem, 'day': days[childIndex(elem) - 1] }));
        sendResponse({ elems: elems });
    } else {
        sendResponse({elems: []});
    }
});
