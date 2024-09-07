import moment from "moment";
import { createEvents } from "ics";
import {
  AuthenticationError,
  CalendarCreationError,
  EventInsertionError,
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

const createColorOption = (color, index) => {
  const colorOption = document.createElement("div");
  colorOption.className = "color-option";
  colorOption.style.backgroundColor = color;
  colorOption.dataset.colorId = index === -1 ? "-1" : index + 1;
  colorOption.addEventListener("click", () => selectColor(colorOption));
  return colorOption;
}

const selectColor = (colorOption) => {
  document.querySelectorAll(".color-option").forEach(el => el.classList.remove("selected"));
  colorOption.classList.add("selected");
}

const initializeColorPicker = () => {
  const colorPicker = document.getElementById("color-picker");

  const noneColor = createColorOption(null, -1);
  noneColor.classList.add("none-color", "selected");
  colorPicker.appendChild(noneColor);

  colors.forEach((color, index) => {
    colorPicker.appendChild(createColorOption(color, index));
  });
}

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
      throw new AuthenticationError("Failed to obtain token. Error: " + error);
    });

  if (!responseUri) {
    throw new AuthenticationError("Invalid `responseUri`");
  }

  const { token, expiresIn } = parseAuthResponse(responseUri);
  if (!token) throw new AuthenticationError("Invalid `token`");

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
    throw new CalendarCreationError("Failed to create calendar. Error: " + error);
  });

  if (!res.ok) {
    throw new CalendarCreationError("Response not OK. Status: " + res.status);
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
    throw new EventInsertionError("Failed to insert event" + error);
  });

  if (!res.ok) {
    throw new EventInsertionError("Failed to insert event");
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

const handleCreateCalendar = async (event) => {
  event.preventDefault();

  const submitButton = document.getElementById("submit");
  submitButton.disabled = true;

  displayMessage("Creating schedule...", "info");

  const calendarName = document.getElementById("textin").value;
  const selectedColorId = document.querySelector(".color-option.selected").dataset.colorId;

  let calendarCreated, headers;
  try {
    const token = await getAuthToken();
    headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const tableData = await retrieveTableData();
    const promises = tableData.map((eventData, index) =>
      insertEvent(calendarData.id, headers, eventData, selectedColorId === "-1" ? (index % 11) + 1 : selectedColorId)
    );

    const calendarData = await createCalendar(calendarName, headers);
    calendarCreated = true;

    await Promise.all(promises);

    displayMessage("Schedule created successfully", "success");
  } catch (error) {
    console.error(error);
    if (calendarCreated) {
      await deleteCalendar(calendarName, headers);
    }
    displayMessage('Failed to create calendar!\nTry reloading banner and opening the "Student Schedule by Day & Time" tab.', "error");
  } finally {
    submitButton.disabled = false;
  }
}

const downloadIcal = async () => {
  const calendarName = document.getElementById("textin").value || "AUS-Schedule";
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
}

const displayMessage = (message, type) => {
  const messageElement = document.getElementById("message");
  messageElement.innerHTML = message.replace(/\n/g, "<br>");
  messageElement.className = `message ${type}`;
}

const handleExportIcal = async () => {
  try {
    await downloadIcal();
    displayMessage("iCal file exported successfully!", "success");
  } catch (error) {
    console.error(error);
    displayMessage('Failed to export iCal file!\nTry reloading banner and opening the "Student Schedule by Day & Time" tab.', "error");
  }
}

const form = document.getElementById("form");
form.addEventListener("submit", handleCreateCalendar);

const exportButton = document.getElementById("export");
exportButton.addEventListener("click", handleExportIcal);

initializeColorPicker();
