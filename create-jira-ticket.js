/**
 * Creates a subtask in Jira LMS project with activity tracking.
 * This script is designed to be run in the browser console while logged into Jira.
 * It demonstrates modular async functions, error handling, and user input validation.
 */

/**
 * Makes authenticated requests to the Jira API
 * @param {string} url - The API endpoint URL
 * @param {Object} options - Request options to override defaults
 * @returns {Promise<Object>} JSON response from the API
 *
 * Key features:
 * - Uses fetch API with credentials for same-origin auth
 * - Handles common error cases (401, non-200 responses)
 * - Includes content-type headers and basic auth
 */
async function jiraRequest(url, options = {}) {
  // Default configuration for all API requests
  const defaults = {
    credentials: "include", // Enables cookie-based authentication
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: "Basic " + btoa("snadar@csod.com:api-token"), // Base64 encoded credentials
    },
  };

  // Merge default options with any custom options
  const config = { ...defaults, ...options };

  try {
    const response = await fetch(url, config);

    // Handle authentication errors specifically
    if (response.status === 401) {
      throw new Error(
        "Not authenticated - please ensure you're logged into Jira"
      );
    }

    // Handle other non-200 responses
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        error.message || `Request failed with status ${response.status}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("API request failed:", error);
    throw error; // Re-throw for handling by caller
  }
}

/**
 * Fetches metadata about available fields for Jira issue creation
 * Useful for debugging and understanding the API structure
 * @returns {Promise<Object>} Available fields and their metadata
 */
async function fetchJiraIssueCreateMeta() {
  try {
    const response = await fetch(
      "/rest/api/2/issue/createmeta?projectKeys=LMS&issuetypeNames=Sub-task&expand=projects.issuetypes.fields"
    );
    const data = await response.json();
    const fields = data.projects[0].issuetypes[0].fields;

    // Log available fields for debugging/development
    console.log("All available fields:");
    Object.keys(fields).forEach((key) => {
      console.log(`Field: ${fields[key].name} | ID: ${key}`);
    });

    return fields;
  } catch (error) {
    console.error("Error fetching Jira issue create meta:", error);
    throw error;
  }
}

/**
 * Retrieves valid activity options for the Jira subtask
 * Uses the customfield_10106 field which contains activity tracking options
 * @returns {Promise<Object|null>} Object containing allowed values and valid options
 */
async function getActivityOptions() {
  try {
    const data = await jiraRequest(
      "/rest/api/2/issue/createmeta?projectKeys=LMS&issuetypeNames=Sub-task&expand=projects.issuetypes.fields"
    );

    // Validate required field exists in response
    if (!data.projects?.[0]?.issuetypes?.[0]?.fields?.customfield_10106) {
      throw new Error("Could not find activity field in API response");
    }

    // Extract activity field data and map to simpler format
    const activityField =
      data.projects[0].issuetypes[0].fields.customfield_10106;
    const validOptions = activityField.allowedValues.map((v) => v.value);

    console.log("Valid Activity options:", validOptions);
    return {
      allowedValues: activityField.allowedValues,
      validOptions,
    };
  } catch (error) {
    console.error("Error fetching activity options:", error);
    alert(
      `Failed to load activity options: ${error.message}\n\nAre you logged into Jira?`
    );
    return null;
  }
}

/**
 * Main function to create a Jira subtask
 * Handles the entire flow from user input to API submission
 * Features:
 * - Input validation
 * - Activity option validation
 * - Error handling
 * - Success feedback with direct link
 * @returns {Promise<Object|void>} Created subtask data or void if validation fails
 */
async function createLMSSubtask() {
  // Step 1: Load and validate activity options
  const activityData = await getActivityOptions();
  if (!activityData || !activityData.allowedValues.length) {
    return; // Exit if activity options can't be loaded
  }

  // Step 2: Collect and validate user input
  const summary = prompt("Subtask summary (required):");
  if (!summary?.trim()) {
    alert("Subtask summary is required");
    return;
  }

  const description = prompt("Subtask description (optional):") || "";

  // Activity selection with validation loop
  let activityValue;
  while (true) {
    activityValue = prompt(
      `Activity (required). Valid options:\n${activityData.validOptions.join(
        "\n"
      )}`
    );

    if (!activityValue) {
      alert("Activity is required");
      continue;
    }

    if (!activityData.validOptions.includes(activityValue)) {
      alert(
        `Invalid activity. Please choose from:\n${activityData.validOptions.join(
          "\n"
        )}`
      );
      continue;
    }

    break;
  }

  // Step 3: Prepare the request payload
  const subtaskData = {
    fields: {
      project: { key: "LMS" },
      parent: { key: "LMS-170042" }, // Parent issue key
      summary: summary.trim(),
      description: description.trim(),
      issuetype: { name: "Sub-task" },
      priority: { name: "Medium" },
      customfield_10106: { value: activityValue }, // Activity tracking field
      assignee: {
        name: "snadar",
        emailAddress: "snadar@csod.com",
      },
    },
  };

  // Step 4: Submit the request and handle response
  try {
    const result = await jiraRequest("/rest/api/2/issue", {
      method: "POST",
      body: JSON.stringify(subtaskData),
    });

    // Generate and display success message with direct link
    const subtaskUrl = `${window.location.origin}/browse/${result.key}`;
    console.log(`Subtask created: ${subtaskUrl}`);
    alert(
      `✅ Subtask created successfully!\n\n${result.key}: ${summary}\n\nOpen: ${subtaskUrl}`
    );
    window.open(subtaskUrl, "_blank");

    return result;
  } catch (error) {
    console.error("Error creating subtask:", error);
    alert(
      `❌ Failed to create subtask:\n${error.message}\n\nPossible issues:\n1. Not logged into Jira\n2. No permission to create subtasks\n3. Parent issue doesn't exist`
    );
  }
}

// Initialize the subtask creation process
createLMSSubtask();
