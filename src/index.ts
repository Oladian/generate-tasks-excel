import * as XLSX from 'xlsx';
import axios from 'axios';
import { format, addDays } from 'date-fns';
import * as cheerio from 'cheerio';

type TaskData = {
  taskId: string;
  taskName: string;
  projectRef: string;
  projectName: string;
  client: string;
  taskType: string;
  timeDedicated: string;
  progress: string;
  weekDays: { day: string; date: string; hours: string }[];
};

type RequestParams = {
  startDate: Date;
  endDate: Date;
  userId: string;
  cookie: string;
};

async function makeTasksRequest(
  date: Date,
  userId: string,
  cookie: string
): Promise<string> {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const url = `https://julia.innovasur.com/projet/activity/perweek.php?year=${year}&month=${month}&day=${day}&search_usertoprocessid=${userId}`;

  try {
    const response = await axios.get(url, {
      headers: { cookie: cookie },
    });
    return response.data;
  } catch (error) {
    console.error(
      `Error obteniendo datos para ${format(date, "yyyy-MM-dd")}:`,
      error
    );
    return '';
  }
}

function parseHTML(html: string): TaskData[] {
  const $ = cheerio.load(html);
  const tasks: TaskData[] = [];
  let currentProject = {
    ref: '',
    name: '',
    client: '',
  };

  const weekDays: { day: string; date: string; hours: string }[] = [];
  for (let i = 0; i <= 4; i++) {
    const headerCell = $(`.bold.hide${i}`);
    if (headerCell.length) {
      const text = headerCell.text().trim();
      const [day, date] = text.split('\n').map((s) => s.trim());
      weekDays.push({ day, date, hours: '' });
    }
  }

  $('tr').each((_, row) => {
    const $row = $(row);

    if ($row.hasClass('trforbreak')) {
      const projectLinks = $row.find('a');
      if (projectLinks.length >= 2) {
        currentProject = {
          ref: projectLinks.eq(0).text().trim() || '',
          client: projectLinks.eq(1).text().trim() || '',
          name: $row.find('span.secondary').text().trim() || '',
        };
      }
      return;
    }

    const taskId = $row.attr('data-taskid');
    if (!taskId) return;

    try {
      const taskName =
        $row.find('span.opacitymedium').first().text().trim() || '';
      const taskType =
        $row.find('td[data-key="tipo_tarea"]').text().trim() || '';
      const timeDedicated = $row.find('td.right a').first().text().trim() || '';
      const progress =
        $row.find('select option:selected').first().text().trim() || '0 %';

      const dailyHours = weekDays.map((day, index) => {
        const timeInput = $row.find(
          `td.hide${index} span.timesheetalreadyrecorded input[disabled]`
        );
        return {
          ...day,
          hours: timeInput.attr("value") || "",
        };
      });

      tasks.push({
        taskId,
        taskName,
        projectRef: currentProject.ref,
        projectName: currentProject.name,
        client: currentProject.client,
        taskType,
        timeDedicated,
        progress,
        weekDays: dailyHours,
      });
    } catch (error) {
      console.error(`Error parseando tarea ${taskId}:`, error);
    }
  });

  return tasks;
}

async function fetchAndParseData(params: RequestParams): Promise<TaskData[]> {
  const allTasks: TaskData[] = [];
  let currentDate = params.startDate;

  while (currentDate <= params.endDate) {
    console.log(`Obteniendo datos de ${format(currentDate, "yyyy-MM-dd")}`);

    const html = await makeTasksRequest(
      currentDate,
      params.userId,
      params.cookie
    );
    if (html) {
      try {
        allTasks.push(...parseHTML(html));
      } catch (error) {
        console.error(`Error procesando datos:`, error);
      }
    }
    await new Promise((res) => setTimeout(res, 1000));
    currentDate = addDays(currentDate, 7);
  }

  return allTasks;
}

function parseDate(day: string): Date {
  const match = day.match(
    /^([A-Za-zÁÉÍÓÚáéíóúñ]{3})(\d{2})\/(\d{2})\/(\d{2})$/
  );
  if (!match) throw new Error(`Formato de fecha inválido: ${day}`);

  const [, , dayNumber, monthNumber, year] = match;
  const dateString = `${monthNumber}/${dayNumber}/20${year}`;
  const date = new Date(dateString);

  return date;
}

async function generateExcel(params: RequestParams, exportButton, spinner) {
  const tasks = await fetchAndParseData(params);

  const taskMap: Record<string, TaskData> = {};

  tasks.flat().forEach((task) => {
    if (!taskMap[task.taskId]) {
      taskMap[task.taskId] = { ...task, weekDays: [...task.weekDays] };
    } else {
      taskMap[task.taskId].weekDays.push(...task.weekDays);
    }
  });

  const groupedTasks = Object.values(taskMap);

  const allDays = Array.from(
    new Set(
      groupedTasks.flatMap((task: any) =>
        task.weekDays.map((day: any) => day.day)
      )
    )
  ).sort(
    (a, b) =>
      parseDate(a as string).getTime() - parseDate(b as string).getTime()
  );

  const excelData = groupedTasks.map((task: any) => {
    const row: any = {
      'Ref de proyecto': task.projectRef,
      'Nombre de tarea': task.taskName,
      'Nombre de proyecto': task.projectName,
      Cliente: task.client,
      'Tipo de tarea': task.taskType,
      Progreso: task.progress,
      'Tiempo dedicado': task.timeDedicated,
    };

    allDays.forEach((day) => {
      const entry = task.weekDays.find((d: any) => d.day === day);
      row[day as string] = entry && entry.hours ? entry.hours : "";
    });

    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Tareas');
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'tareas.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  spinner.style.display = 'none';
  exportButton.removeAttribute('disabled');
  alert('Exportación completada');
}

document.addEventListener('DOMContentLoaded', () => {
  const exportButton = document.getElementById('exportExcel');
  const spinner = document.getElementById('spinner');
  const startDateElement = document.getElementById(
    'startDate'
  ) as HTMLInputElement;
  const endDateElement = document.getElementById('endDate') as HTMLInputElement;
  const cookieElement = document.getElementById(
    'cookieValue'
  ) as HTMLTextAreaElement;
  const userIdElement = document.getElementById('userId') as HTMLInputElement;

  function validateDates() {
    if (
      startDateElement.value &&
      endDateElement.value &&
      startDateElement.value <= endDateElement.value
    ) {
      exportButton.removeAttribute('disabled');
    } else {
      exportButton.setAttribute('disabled', 'true');
    }
  }

  startDateElement.addEventListener('change', validateDates);
  endDateElement.addEventListener('change', validateDates);

  if (exportButton) {
    exportButton.addEventListener('click', () => {
      exportButton.setAttribute('disabled', 'true');
      spinner.style.display = 'block';

      const startDate = startDateElement?.value
        ? new Date(startDateElement.value)
        : new Date();
      const endDate = endDateElement?.value
        ? new Date(endDateElement.value)
        : new Date();
      const cookieValue = cookieElement?.value || '';
      const userId = userIdElement?.value || 'usuario';

      console.log('Exportando con:', {
        startDate,
        endDate,
        cookieValue,
        userId,
      });

      const params: RequestParams = {
        startDate,
        endDate,
        userId,
        cookie: cookieValue,
      };

      generateExcel(params, exportButton, spinner);
    });
  }
});