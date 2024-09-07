import moment from "moment";
import { createEvents } from "ics";
import {
  AuthenticationError,
  CalendarCreationError,
  EventError,
  ParsingError,
} from "./errors";

const dayMapping = {
  Monday: "MO",
  Tuesday: "TU",
  Wednesday: "WE",
  Thursday: "TH",
  Friday: "FR",
  Saturday: "SA",
  Sunday: "SU",
};

const colors = [
  "#a4bdfc",
  "#7ae7bf",
  "#dbadff",
  "#ff887c",
  "#fbd75b",
  "#ffb878",
  "#46d6db",
  "#e1e1e1",
  "#5484ed",
  "#51b749",
  "#dc2127",
];

const createColorOption = (colorId, color, isChecked = false) => {
  const elementString = `
        <label>
          <input type="radio" name="colorPicker" value=${colorId}>
          <span class="custom-radio"></span>
        </label>
        `;
  const parser = new DOMParser();
  const doc = parser.parseFromString(elementString, "text/html");
  const element = doc.body.firstChild;
  const spanElement = doc.getElementsByTagName("span")[0];
  if (color) spanElement.style.backgroundColor = color;
  else spanElement.classList.add("none-color");
  doc.getElementsByTagName("input")[0].checked = isChecked;
  return element;
};

const getAuthToken = async () => {
  let token = localStorage.getItem("authToken");
  const expirationTime = localStorage.getItem("authTokenExpiration");
  if (token && expirationTime && Date.now() < expirationTime) {
    return token;
  }

  const { token: newToken, expiresIn } = await requestToken();
  token = newToken;
  localStorage.setItem("authToken", token);

  const expiration = Date.now() + expiresIn * 1000;
  localStorage.setItem("authTokenExpiration", expiration.toString());
  return token;
};

const parseAuthResponse = (responseUri) => {
  let responseParams = responseUri.split("#")[1];
  responseParams = new URLSearchParams(responseParams);
  const token = responseParams.get("access_token");
  const expiresIn = responseParams.get("expires_in");
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

  const responseUri = await chrome.identity
    .launchWebAuthFlow({
      interactive: true,
      url: AUTH_URL,
    })
    .catch((error) => {
      throw new AuthenticationError("Failed to obtain token " + error);
    });

  if (!responseUri) {
    throw new AuthenticationError("Failed to obtain token");
  }

  const { token, expiresIn } = parseAuthResponse(responseUri);
  if (!token) throw new AuthenticationError("Failed to obtain token");

  return { token, expiresIn };
};

const createCalendar = async (calendarName, headers) => {
  const res = await fetch("https://www.googleapis.com/calendar/v3/calendars", {
    method: "POST",
    headers: headers,
    body: JSON.stringify({
      summary: calendarName,
    }),
  }).catch((error) => {
    throw new CalendarCreationError("Failed to create calendar " + error);
  });

  if (!res.ok) {
    throw new CalendarCreationError("Failed to create calendar");
  }

  return await res.json();
};

const deleteCalendar = async (calendarName, headers) => {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarName}`,
    {
      method: "DELETE",
      headers: headers,
    }
  );

  if (!res.ok) {
    console.error("Failed to delete calendar:", res.status);
    return;
  }

  return await res.text();
};

const insertEvent = async (calendarName, headers, eventData, colorId) => {
  const formattedDays = eventData.days.map((day) => dayMapping[day]).join(",");
  const startTime = moment(eventData.startTime, "dddd h:mm a").toISOString();
  const endTime = moment(eventData.endTime, "dddd h:mm a").toISOString();
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

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarName}/events`,
    {
      method: "POST",
      headers: headers,
      body: JSON.stringify(body),
    }
  ).catch((error) => {
    throw new EventError("Failed to insert event" + error);
  });

  if (!res.ok) {
    throw new EventError("Failed to insert event");
  }

  return await res.json();
};

const retrieveTableData = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const { elems, error } = await chrome.tabs.sendMessage(tab.id, {
    message: "retrieve_table_data",
  });

  if (error) {
    throw new ParsingError(error);
  }

  return elems;
};

const createSchedule = async () => {
  let calendarData;
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

    const tableData = await retrieveTableData();

    calendarData = await createCalendar(calendarName, headers);

    const selectedColorId = document.querySelector(
      'input[name="colorPicker"]:checked'
    ).value;

    let promises;
    if (selectedColorId === "-1") {
      promises = tableData.map((eventData, index) =>
        insertEvent(calendarData.id, headers, eventData, (index % 11) + 1)
      );
    } else {
      promises = tableData.map((eventData) =>
        insertEvent(calendarData.id, headers, eventData, selectedColorId)
      );
    }

    await Promise.all(promises);
    displayMessage("Schedule created successfully", "green");
  } catch (error) {
    if (error instanceof EventError)
      await deleteCalendar(calendarData.id, headers);

    console.error(error);
    displayMessage(error.message, "red");
  } finally {
    document.getElementById("submit").disabled = false;
  }
};

const downloadIcal = async () => {
  try {
    const calendarName = document.getElementById("textin").value;
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
      throw new ParsingError("Failed to create iCal file");
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
  } catch (error) {
    console.error("Failed to create iCal file");
    displayMessage("Failed to create iCal file", "red");
  }
};

const displayMessage = (message, color) => {
  const messageDiv = document.getElementById("message");
  messageDiv.textContent = message;
  messageDiv.style.display = "block";
  messageDiv.style.color = color;
};

document.getElementById("form").onsubmit = async (event) => {
  event.preventDefault();
  if (event.submitter.value === "submit") {
    await createSchedule();
  } else if (event.submitter.value === "ical") {
    await downloadIcal();
  }
};

const colorPicker = document.getElementById("color-picker");

colorPicker.appendChild(createColorOption(-1, null, true));

colors.forEach((color, index) => {
  colorPicker.appendChild(createColorOption(index + 1, color));
});
