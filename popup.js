import moment from "moment";

const getAuthToken = async () => {
  // Check localStorage for existing token
  let token = localStorage.getItem("authToken");
  const expirationTime = localStorage.getItem("authTokenExpiration");
  if (token && expirationTime && Date.now() < expirationTime) {
    return token; // Return valid token if not expired
  }

  const { token: newToken, expiresIn } = await requestToken();
  token = newToken;
  localStorage.setItem("authToken", token);

  const expiration = Date.now() + expiresIn * 1000; //convert to msec
  localStorage.setItem("authTokenExpiration", expiration.toString());
  return token;
};

const parseResponse = (responseUri) => {
  let responseParams = responseUri.split("#")[1];
  responseParams = new URLSearchParams(responseParams);
  let token = responseParams.get("access_token");
  let expiresIn = responseParams.get("expires_in");
  return { token, expiresIn };
};

const requestToken = async () => {
  const manifest = chrome.runtime.getManifest();
  const REDIRECT_URL = chrome.identity.getRedirectURL();
  // client ID of the Web Application and NOT the chrome extension
  const CLIENT_ID =
    "85232819736-kvha7463v3n834f8s2gfjqfrsoefhhm0.apps.googleusercontent.com";
  const SCOPES = manifest.oauth2.scopes;
  const AUTH_URL = `https://accounts.google.com/o/oauth2/auth\
?client_id=${CLIENT_ID}\
&response_type=token\
&redirect_uri=${encodeURIComponent(REDIRECT_URL)}\
&scope=${encodeURIComponent(SCOPES.join(" "))}`;

  try {
    let responseUri = await chrome.identity.launchWebAuthFlow({
      interactive: true,
      url: AUTH_URL,
    });

    if (!responseUri) {
      throw new Error("Failed to obtain token");
    }

    const { token, expiresIn } = parseResponse(responseUri);
    console.log("token", token, "expiresIn", expiresIn);
    if (!token || token.length < 1) throw new Error("Failed to obtain token");

    return { token, expiresIn };
  } catch (error) {
    console.error(error);
    throw new Error("Failed to obtain token");
  }
};

const createCalendar = async (calendarName, headers) => {
  let res = await fetch("https://www.googleapis.com/calendar/v3/calendars", {
    method: "POST",
    headers: headers,
    body: JSON.stringify({
      summary: calendarName,
    }),
  });
  if (!res.ok) {
    console.error("Failed to create calendar:", res.status);
    throw new Error("Failed to create calendar");
  }

  return await res.json();
};

const createSchedule = async (event) => {
  event.preventDefault();
  let data;
  let headers;
  document.getElementById("submit").disabled = true;
  displayMessage("Creating schedule...", "black");
  try {
    const token = await getAuthToken();
    const calendarName = document.getElementById("textin").value;

    headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    data = await createCalendar(calendarName, headers);

    const tableData = await retrieveTableData();
    let promises = tableData.map((eventData, index) =>
      insertEvent(data.id, headers, eventData, (index % 11) + 1)
    );
    let results = await Promise.all(promises);
    displayMessage("Schedule created successfully", "green");
  } catch (error) {
    if (
      error.message !== "Failed to create calendar" &&
      error.message !== "Failed to obtain token"
    )
      await deleteCalendar(data.id, headers);
    console.error(error);
    displayMessage(error, "red");
  } finally {
    document.getElementById("submit").disabled = false;
  }
};

const deleteCalendar = async (calendarName, headers) => {
  let res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarName}`,
    {
      method: "DELETE",
      headers: headers,
    }
  );

  if (!res.ok) {
    console.error("Failed to delete calendar:", res.status);
  }

  return await res.text();
};

const insertEvent = async (calendarName, headers, eventData, colorId) => {
  const dayMapping = {
    Monday: "MO",
    Tuesday: "TU",
    Wednesday: "WE",
    Thursday: "TH",
    Friday: "FR",
    Saturday: "SA",
    Sunday: "SU",
  };

  let formattedDays = eventData.days.map((day) => dayMapping[day]).join(",");
  let startTime = moment(eventData.startTime, "dddd h:mm a").toISOString();
  let endTime = moment(eventData.endTime, "dddd h:mm a").toISOString();
  const body = {
    summary: eventData.course,
    location: eventData.location,
    start: {
      dateTime: startTime,
      timeZone: "Asia/Dubai",
    },
    end: {
      dateTime: endTime,
      timeZone: "Asia/Dubai",
    },
    colorId: colorId,
    recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=" + formattedDays],
  };

  let res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarName}/events`,
    {
      method: "POST",
      headers: headers,
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    console.error("Failed to insert event:", res.status);
    throw new Error("Failed to insert event");
  }

  return await res.json();
};

const retrieveTableData = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const response = await chrome.tabs.sendMessage(tab.id, {
    message: "retrieve_table_data",
  });

  // console.log('response', response)
  if (!response.elems) {
    console.error("Failed to retrieve table data");
    return;
  }

  return response.elems;
};

// create a function that displays the error on the DOM
const displayMessage = (message, color) => {
  const messageDiv = document.getElementById("message");
  messageDiv.textContent = message;
  messageDiv.style.display = "block";
  messageDiv.style.color = color;
  messageDiv.style.border = "2px solid";
  messageDiv.style.borderRadius = "10px";
  messageDiv.style.borderColor = color;
  messageDiv.style.padding = "5px";
  messageDiv.style.fontSize = "10pt";

  setTimeout(() => {
    messageDiv.textContent = "";
    messageDiv.style.display = "none";
  }, 5000);
};

document.getElementById("form").onsubmit = createSchedule;
