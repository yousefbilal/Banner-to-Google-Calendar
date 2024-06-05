
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('content_script.js received message');
    console.log(request);
    if (request.message === 'retrieve_table_data') {
        let [...elems] = window.frames[1].document.querySelectorAll('td.ddlabel');
        elems = elems.map(elem => elem.innerText);
        console.log('elems', elems);
        sendResponse({ elems: elems });
    } else {
        sendResponse({elems: []});
    }
});
