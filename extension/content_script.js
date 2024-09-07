import { ParsingError } from "./errors";

const messageHandlers = {
  retrieve_table_data: () => {
    try {
      const tableData = parseTimetable();
      return { elems: tableData, error: null };
    } catch (error) {
      return { elems: [], error: error.message };
    }
  },
  default: () => {
    return { elems: [], error: "Invalid message" };
  },
};

chrome.runtime.onMessage.addListener((request, _, sendResponse) => {
  const handler = messageHandlers[request.message] || messageHandlers.default;
  const response = handler();
  sendResponse(response);
});

const parseTimetable = () => {
  const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];
  const timeTable = frames[1].document.querySelector(
    '.datadisplaytable[summary="This layout table is used to present the weekly course schedule."]'
  );

  if (!timeTable) throw new ParsingError("Failed to parse timetable data");

  const rows = Array.from(timeTable.querySelectorAll("tr"));
  rows.shift();
  let courses = {};
  let paddingTDs = [];

  rows.forEach((row, i) => {
    const cells = row.querySelectorAll("td");

    cells.forEach((cell, index) => {
      if (cell.innerHTML.trim() === "&nbsp;") return;

      let [course, crn, time, location] = cell.innerText.split("\n");
      let day = days[index];
      const numEmptySlots = parseInt(cell.getAttribute("rowspan")) - 1;
      for (let j = 1; j <= numEmptySlots; j++) {
        const nextRow = rows[i + j];
        const emptyCell = document.createElement("td");
        emptyCell.innerHTML = "&nbsp;";
        emptyCell.style.display = "none";
        // check if row has a TH element, if so increase insertIndex by 1
        let insertIndex = nextRow.querySelector("th") ? index + 1 : index;
        nextRow.insertBefore(emptyCell, nextRow.children[insertIndex]);
        paddingTDs.push(emptyCell);
      }

      if (!courses[crn]) {
        let [startTime, endTime] = time.split("-");
        startTime = `${day} ${startTime}`;
        endTime = `${day} ${endTime}`;
        courses[crn] = {
          course,
          startTime,
          endTime,
          location,
          days: [],
        };
      }

      courses[crn].days.push(day);
    });
  });

  // Remove padding tds
  paddingTDs.forEach((paddingTD) => {
    paddingTD.remove();
  });

  return Object.values(courses);
};
