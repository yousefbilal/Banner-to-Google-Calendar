
const childIndex = (childNode) => {
    const [...children] =  childNode.parentNode.children
    
    return children.length > 7 ? children.indexOf(childNode) - 1 : children.indexOf(childNode);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('content_script.js received message');
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    console.log(request);
    if (request.message === 'retrieve_table_data') {

        let [...elems] = window.frames[1].document.querySelectorAll('td.ddlabel');
        elems = elems.map(elem => ({'elem': elem.innerText.split('\n'), 'day': days[childIndex(elem)] }));
        console.log('elems', elems);
        sendResponse({ elems: elems });
    } else {
        sendResponse({elems: []});
    }
});
