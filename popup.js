import moment from "moment";
import { createEvents } from "ics";

const MessageType = {
  INFO: "info",
  ERROR: "error",
  SUCCESS: "success",
}

const dayMapping = {
  Monday: "MO",
  Tuesday: "TU",
  Wednesday: "WE",
  Thursday: "TH",
  Friday: "FR",
  Saturday: "SA",
  Sunday: "SU",
};

const getAuthToken = async () => {
  // Check localStorage for existing token
  let authToken = localStorage.getItem("authToken");
  const expirationTime = localStorage.getItem("authTokenExpiration");
  if (authToken && expirationTime && Date.now() < expirationTime) {
    return authToken;
  }

  const { token: newToken, expiresIn } = await requestToken();
  authToken = newToken;
  localStorage.setItem("authToken", authToken);

  const expiration = Date.now() + expiresIn * 1000; //convert to msec
  localStorage.setItem("authTokenExpiration", expiration.toString());
  return authToken;
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
  const CLIENT_ID = manifest.oauth2.client_id;
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

const createSchedule = async () => {
  document.getElementById("submit").disabled = true;
  displayMessage("Creating schedule...", MessageType.INFO);

  try {
    const token = await getAuthToken();
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const calendarName = document.getElementById("calendar-name").value;
    const calendarData = await createCalendar(calendarName, headers);

    const tableData = await retrieveTableData();
    const colorId = document.getElementById("color-selector").value
    let promises = tableData.map((eventData, index) =>
      insertEvent(calendarData.id, headers, eventData, colorId === "default" ? (index % 11) + 1 : colorId)
    );
    await Promise.all(promises);
    displayMessage("Schedule created successfully", MessageType.SUCCESS);
  } catch (error) {
    if (
      error.message !== "Failed to create calendar" &&
      error.message !== "Failed to obtain token"
    )
      await deleteCalendar(calendarData.id, headers);
    console.error(error);
    displayMessage("Something went wrong! 🥲\nTry reloading banner and opening the 'Student Schedule by Day & Time' tab", MessageType.ERROR);
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
    throw new Error("Failed to insert event");
  }

  return await res.json();
};

const retrieveTableData = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const response = await chrome.tabs.sendMessage(tab.id, {
    message: "retrieve_table_data",
  });

  if (!response.elems) {
    console.error("Failed to retrieve table data");
    return;
  }

  return response.elems;
};

const downloadIcal = async () => {
  const calendarName = document.getElementById("calendar-name").value;
  const fileName = calendarName + ".ics";
  const tableData = await retrieveTableData();
  const { error, value } = createEvents(
    tableData.map((eventData) => {
      return {
        title: eventData.course,
        location: eventData.location,
        calName: calendarName,
        start: moment(eventData.startTime, "dddd h:mm a").toDate().getTime(),
        end: moment(eventData.endTime, "dddd h:mm a").toDate().getTime(),
        recurrenceRule:
          "FREQ=WEEKLY;BYDAY=" +
          eventData.days.map((day) => dayMapping[day]).join(","),
      };
    })
  );
  if (error) {
    console.error(error);
    displayMessage("Failed to create iCal file", "red");
    return;
  }
  const file = new File([value], fileName, { type: "text/calendar" });
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;

  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  URL.revokeObjectURL(url);
};

const displayMessage = (message, type) => {
  const messageDiv = document.getElementById("message");
  messageDiv.innerHTML = message.replace(/\n/g, "<br>");
  messageDiv.style.display = "block";
  messageDiv.className = `message ${type}`;
};

document.getElementById("form").onsubmit = async (event) => {
  event.preventDefault();
  if (event.submitter.value === "submit") {
    await createSchedule();
  } else if (event.submitter.value === "ical") {
    await downloadIcal();
  }
};
