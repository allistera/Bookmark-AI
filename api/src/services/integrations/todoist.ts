/**
 * Todoist integration service
 */

export interface TodoistResult {
  created: boolean;
  taskId?: string;
  error?: string;
}

/**
 * Create a task in Todoist using the REST API v2
 */
export async function createTodoistTask(
  title: string,
  url: string,
  summary: string,
  apiToken: string
): Promise<TodoistResult> {
  const todoistUrl = 'https://api.todoist.com/rest/v2/tasks';

  // Create task content with URL and summary
  const taskContent = `${title}\n${url}\n\n${summary}`;

  try {
    console.log(`Creating Todoist task: ${title}`);
    const response = await fetch(todoistUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        content: taskContent,
      }),
    });

    if (response.status === 200) {
      // Successfully created
      const taskData = (await response.json()) as { id: string };
      return { created: true, taskId: taskData.id };
    } else if (response.status === 403) {
      return { created: false, error: 'Invalid Todoist API token' };
    } else if (response.status === 400) {
      return { created: false, error: 'Invalid request parameters' };
    } else {
      const errorText = await response.text();
      return {
        created: false,
        error: `Unexpected status: ${response.status} - ${errorText}`,
      };
    }
  } catch (error) {
    console.error('Error creating Todoist task:', error);
    return {
      created: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
