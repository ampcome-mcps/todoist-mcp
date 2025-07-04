#!/usr/bin/env node

import express from 'express';
import dotenv from 'dotenv';
import { TodoistApi } from '@doist/todoist-api-typescript';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import fetch from 'node-fetch';
import { z } from 'zod';

dotenv.config();

// Nango Authentication Types and Functions
interface NangoCredentials {
    credentials: {
        access_token: string;
        refresh_token?: string;
        expires_at?: string;
        [key: string]: any;
    };
    connectionId: string;
    providerConfigKey: string;
    [key: string]: any;
}

/**
 * Get credentials from Nango
 */
async function getConnectionCredentials(): Promise<NangoCredentials> {
    const connectionId = process.env.NANGO_CONNECTION_ID;
    const integrationId = process.env.NANGO_INTEGRATION_ID;
    const baseUrl = process.env.NANGO_BASE_URL;
    const secretKey = process.env.NANGO_SECRET_KEY;

    if (!connectionId || !integrationId || !baseUrl || !secretKey) {
        throw new Error('Missing required Nango environment variables: NANGO_CONNECTION_ID, NANGO_INTEGRATION_ID, NANGO_BASE_URL, NANGO_SECRET_KEY');
    }

    const url = `${baseUrl}/connection/${connectionId}`;
    const params = new URLSearchParams({
        provider_config_key: integrationId,
        refresh_token: 'true',
    });

    const headers = {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
    };

    try {
        const response = await fetch(`${url}?${params}`, {
            method: 'GET',
            headers
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to get connection credentials: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const credentials = await response.json() as NangoCredentials;
        return credentials;
    } catch (error) {
        console.error('Error fetching Nango credentials:', error);
        throw error;
    }
}

/**
 * Get access token from Nango credentials
 */
async function getAccessToken(): Promise<string> {
    try {
        const credentials = await getConnectionCredentials();
        const accessToken = credentials.credentials?.access_token;
        
        if (!accessToken) {
            throw new Error('Access token not found in Nango credentials');
        }
        
        return accessToken;
    } catch (error) {
        console.error('Error getting access token:', error);
        throw new Error(`Failed to get access token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Check if the access token is valid and not expired
 */
function isTokenExpired(credentials: NangoCredentials): boolean {
    if (!credentials.credentials?.expires_at) {
        return false; // If no expiration info, assume it's still valid
    }
    
    const expiresAt = new Date(credentials.credentials.expires_at);
    const now = new Date();
    
    // Add 5 minute buffer to refresh before actual expiration
    const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
    return (expiresAt.getTime() - now.getTime()) < bufferTime;
}

/**
 * Refresh the access token if needed
 */
async function refreshTokenIfNeeded(): Promise<string> {
    try {
        const credentials = await getConnectionCredentials();
        
        if (isTokenExpired(credentials)) {
            console.log('Token is expired or expiring soon, refreshing...');
            // The refresh_token: 'true' parameter in getConnectionCredentials
            // should handle the refresh automatically
            const newCredentials = await getConnectionCredentials();
            return newCredentials.credentials.access_token;
        }
        
        return credentials.credentials.access_token;
    } catch (error) {
        console.error('Error refreshing token:', error);
        throw error;
    }
}

// Initialize Todoist API client with Nango authentication
let todoistApi: TodoistApi;

async function initializeTodoistApi(): Promise<void> {
    try {
        const accessToken = await getAccessToken();
        todoistApi = new TodoistApi(accessToken);
        console.error('Todoist API initialized with Nango authentication');
    } catch (error) {
        console.error('Failed to initialize Todoist API with Nango:', error);
        console.error('Please ensure all Nango environment variables are set correctly:');
        console.error('- NANGO_CONNECTION_ID');
        console.error('- NANGO_INTEGRATION_ID');
        console.error('- NANGO_BASE_URL');
        console.error('- NANGO_SECRET_KEY');
        process.exit(1);
    }
}

// Create the MCP server
const server = new McpServer({
    name: "Todoist MCP Server",
    version: "1.0.0"
});

// Tasks
server.tool(
    "listTasks",
    {
        description: "List tasks from Todoist. You can filter by project, label, or use a custom filter string.",
        projectId: z.string().optional().describe("Filter tasks by project ID"),
        label: z.string().optional().describe("Filter tasks by label name"),
        filter: z.string().optional().describe("Custom filter string (e.g., 'today', 'overdue', 'p1')")
    },
    async ({ projectId, label, filter }) => {
        try {
            const params: any = {};
            if (projectId) params.projectId = projectId;
            if (label) params.label = label;
            if (filter) params.filter = filter;

            const tasks = await todoistApi.getTasks(params);
            return { content: [{ type: "text", text: JSON.stringify({ tasks }, null, 2) }] };
        } catch (error) {
            console.error('Error fetching tasks:', error);
            return {
                content: [{ type: "text", text: "Failed to fetch tasks" }],
                isError: true
            };
        }
    }
);

server.tool(
    "getTask",
    {
        description: "Get details of a specific task by its ID.",
        taskId: z.string().describe("The ID of the task to retrieve")
    },
    async ({ taskId }) => {
        try {
            const task = await todoistApi.getTask(taskId);
            return { content: [{ type: "text", text: JSON.stringify({ task }, null, 2) }] };
        } catch (error) {
            console.error('Error fetching task:', error);
            return {
                content: [{ type: "text", text: "Failed to fetch task" }],
                isError: true
            };
        }
    }
);

server.tool(
    "createTask",
    {
        description: "Create a new task in Todoist with various optional parameters.",
        content: z.string().describe("The task content/title (required)"),
        projectId: z.string().optional().describe("Project ID to add the task to"),
        dueString: z.string().optional().describe("Due date in natural language (e.g., 'today', 'tomorrow', 'next Monday')"),
        priority: z.number().optional().describe("Priority level (1-4, where 4 is highest)"),
        labels: z.array(z.string()).optional().describe("Array of label names to assign to the task"),
        order: z.number().optional().describe("Position in the project"),
        parentId: z.string().optional().describe("Parent task ID to create a subtask"),
        sectionId: z.string().optional().describe("Section ID within the project"),
        assigneeId: z.string().optional().describe("User ID to assign the task to"),
        dueLang: z.string().optional().describe("Language for due date parsing"),
        dueDate: z.string().optional().describe("Due date in YYYY-MM-DD format"),
        dueDatetime: z.string().optional().describe("Due date with time in RFC3339 format")
    },
    async (params) => {
        try {
            const taskArgs: any = {
                content: params.content
            };

            if (params.projectId) taskArgs.projectId = params.projectId;
            if (params.dueString) taskArgs.dueString = params.dueString;
            if (params.priority) taskArgs.priority = params.priority;
            if (params.labels) taskArgs.labels = params.labels;
            if (params.description) taskArgs.description = params.description;
            if (params.order) taskArgs.order = params.order;
            if (params.parentId) taskArgs.parentId = params.parentId;
            if (params.sectionId) taskArgs.sectionId = params.sectionId;
            if (params.assigneeId) taskArgs.assigneeId = params.assigneeId;
            if (params.dueLang) taskArgs.dueLang = params.dueLang;

            if (params.dueString) {
                taskArgs.dueString = params.dueString;
            } else if (params.dueDate) {
                taskArgs.dueDate = params.dueDate;
            } else if (params.dueDatetime) {
                taskArgs.dueDatetime = params.dueDatetime;
            }

            const task = await todoistApi.addTask(taskArgs);
            return { content: [{ type: "text", text: JSON.stringify({ task }, null, 2) }] };
        } catch (error) {
            console.error('Error creating task:', error);
            return {
                content: [{ type: "text", text: "Failed to create task" }],
                isError: true
            };
        }
    }
);

server.tool(
    "updateTask",
    {
        description: "Update an existing task with new information.",
        taskId: z.string().describe("The ID of the task to update"),
        content: z.string().optional().describe("New task content/title"),
        labels: z.array(z.string()).optional().describe("New array of label names"),
        priority: z.number().optional().describe("New priority level (1-4)"),
        dueString: z.string().optional().describe("New due date in natural language"),
        dueLang: z.string().optional().describe("Language for due date parsing"),
        dueDate: z.string().optional().describe("New due date in YYYY-MM-DD format"),
        dueDatetime: z.string().optional().describe("New due date with time in RFC3339 format"),
        assigneeId: z.string().optional().describe("New assignee user ID")
    },
    async (params) => {
        try {
            const { taskId, ...updateParams } = params;
            const taskArgs: any = {};

            if (updateParams.content) taskArgs.content = updateParams.content;
            if (updateParams.description) taskArgs.description = updateParams.description;
            if (updateParams.labels) taskArgs.labels = updateParams.labels;
            if (updateParams.priority) taskArgs.priority = updateParams.priority;
            if ('assigneeId' in updateParams) taskArgs.assigneeId = updateParams.assigneeId;
            if (updateParams.dueLang) taskArgs.dueLang = updateParams.dueLang;

            if (updateParams.dueString) {
                taskArgs.dueString = updateParams.dueString;
            } else if (updateParams.dueDate) {
                taskArgs.dueDate = updateParams.dueDate;
            } else if (updateParams.dueDatetime) {
                taskArgs.dueDatetime = updateParams.dueDatetime;
            }

            const success = await todoistApi.updateTask(taskId, taskArgs);
            return { content: [{ type: "text", text: JSON.stringify({ success }, null, 2) }] };
        } catch (error) {
            console.error('Error updating task:', error);
            return {
                content: [{ type: "text", text: "Failed to update task" }],
                isError: true
            };
        }
    }
);

server.tool(
    "completeTask",
    {
        description: "Mark a task as completed.",
        taskId: z.string().describe("The ID of the task to complete")
    },
    async ({ taskId }) => {
        try {
            const result = await todoistApi.closeTask(taskId);
            return { content: [{ type: "text", text: JSON.stringify({ success: result }, null, 2) }] };
        } catch (error) {
            console.error('Error completing task:', error);
            return {
                content: [{ type: "text", text: "Failed to complete task" }],
                isError: true
            };
        }
    }
);

server.tool(
    "reopenTask",
    {
        description: "Reopen a previously completed task.",
        taskId: z.string().describe("The ID of the task to reopen")
    },
    async ({ taskId }) => {
        try {
            const result = await todoistApi.reopenTask(taskId);
            return { content: [{ type: "text", text: JSON.stringify({ success: result }, null, 2) }] };
        } catch (error) {
            console.error('Error reopening task:', error);
            return {
                content: [{ type: "text", text: "Failed to reopen task" }],
                isError: true
            };
        }
    }
);

server.tool(
    "deleteTask",
    {
        description: "Permanently delete a task.",
        taskId: z.string().describe("The ID of the task to delete")
    },
    async ({ taskId }) => {
        try {
            const result = await todoistApi.deleteTask(taskId);
            return { content: [{ type: "text", text: JSON.stringify({ success: result }, null, 2) }] };
        } catch (error) {
            console.error('Error deleting task:', error);
            return {
                content: [{ type: "text", text: "Failed to delete task" }],
                isError: true
            };
        }
    }
);

// Projects
server.tool(
    "listProjects",
    {
        description: "List all projects in your Todoist account."
    },
    async () => {
        try {
            const projects = await todoistApi.getProjects();
            return { content: [{ type: "text", text: JSON.stringify({ projects }, null, 2) }] };
        } catch (error) {
            console.error('Error fetching projects:', error);
            return {
                content: [{ type: "text", text: "Failed to fetch projects" }],
                isError: true
            };
        }
    }
);

server.tool(
    "getProject",
    {
        description: "Get details of a specific project by its ID.",
        projectId: z.string().describe("The ID of the project to retrieve")
    },
    async ({ projectId }) => {
        try {
            const project = await todoistApi.getProject(projectId);
            return { content: [{ type: "text", text: JSON.stringify({ project }, null, 2) }] };
        } catch (error) {
            console.error('Error fetching project:', error);
            return {
                content: [{ type: "text", text: "Failed to fetch project" }],
                isError: true
            };
        }
    }
);

server.tool(
    "createProject",
    {
        description: "Create a new project in Todoist.",
        name: z.string().describe("The name of the project (required)"),
        parentId: z.string().optional().describe("Parent project ID to create a sub-project"),
        color: z.string().optional().describe("Project color (e.g., 'red', 'blue', 'green')"),
        isFavorite: z.boolean().optional().describe("Whether to mark as favorite"),
        viewStyle: z.enum(['list', 'board']).optional().describe("Project view style")
    },
    async (params) => {
        try {
            const project = await todoistApi.addProject({
                name: params.name,
                parentId: params.parentId,
                color: params.color,
                isFavorite: params.isFavorite,
                viewStyle: params.viewStyle,
            });
            return { content: [{ type: "text", text: JSON.stringify({ project }, null, 2) }] };
        } catch (error) {
            console.error('Error creating project:', error);
            return {
                content: [{ type: "text", text: "Failed to create project" }],
                isError: true
            };
        }
    }
);

server.tool(
    "updateProject",
    {
        description: "Update an existing project.",
        projectId: z.string().describe("The ID of the project to update"),
        name: z.string().optional().describe("New project name"),
        color: z.string().optional().describe("New project color"),
        isFavorite: z.boolean().optional().describe("Whether to mark as favorite"),
        viewStyle: z.enum(['list', 'board']).optional().describe("New project view style")
    },
    async (params) => {
        try {
            const { projectId, ...updateParams } = params;
            const success = await todoistApi.updateProject(projectId, updateParams);
            return { content: [{ type: "text", text: JSON.stringify({ success }, null, 2) }] };
        } catch (error) {
            console.error('Error updating project:', error);
            return {
                content: [{ type: "text", text: "Failed to update project" }],
                isError: true
            };
        }
    }
);

server.tool(
    "archiveProject",
    {
        description: "Archive a project (hide it from active view).",
        projectId: z.string().describe("The ID of the project to archive")
    },
    async ({ projectId }) => {
        try {
            const accessToken = await refreshTokenIfNeeded();
            const response = await fetch(`https://api.todoist.com/rest/v2/projects/${projectId}/archive`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to archive project: ${response.statusText}`);
            }

            return { content: [{ type: "text", text: JSON.stringify({ success: true }, null, 2) }] };
        } catch (error) {
            console.error('Error archiving project:', error);
            return {
                content: [{ type: "text", text: "Failed to archive project" }],
                isError: true
            };
        }
    }
);

server.tool(
    "unarchiveProject",
    {
        description: "Unarchive a project (restore it to active view).",
        projectId: z.string().describe("The ID of the project to unarchive")
    },
    async ({ projectId }) => {
        try {
            const accessToken = await refreshTokenIfNeeded();
            const response = await fetch(`https://api.todoist.com/rest/v2/projects/${projectId}/unarchive`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to unarchive project: ${response.statusText}`);
            }

            return { content: [{ type: "text", text: JSON.stringify({ success: true }, null, 2) }] };
        } catch (error) {
            console.error('Error unarchiving project:', error);
            return {
                content: [{ type: "text", text: "Failed to unarchive project" }],
                isError: true
            };
        }
    }
);

server.tool(
    "deleteProject",
    {
        description: "Permanently delete a project and all its tasks.",
        projectId: z.string().describe("The ID of the project to delete")
    },
    async ({ projectId }) => {
        try {
            const success = await todoistApi.deleteProject(projectId);
            return { content: [{ type: "text", text: JSON.stringify({ success }, null, 2) }] };
        } catch (error) {
            console.error('Error deleting project:', error);
            return {
                content: [{ type: "text", text: "Failed to delete project" }],
                isError: true
            };
        }
    }
);

server.tool(
    "getProjectCollaborators",
    {
        description: "Get the list of collaborators for a specific project.",
        projectId: z.string().describe("The ID of the project to get collaborators for")
    },
    async ({ projectId }) => {
        try {
            const collaborators = await todoistApi.getProjectCollaborators(projectId);
            return { content: [{ type: "text", text: JSON.stringify({ collaborators }, null, 2) }] };
        } catch (error) {
            console.error('Error fetching project collaborators:', error);
            return {
                content: [{ type: "text", text: "Failed to fetch project collaborators" }],
                isError: true
            };
        }
    }
);

// Sections
server.tool(
    "listSections",
    {
        description: "List sections within a project. Sections help organize tasks within projects.",
        projectId: z.string().optional().describe("Project ID to get sections for (returns empty if not provided)")
    },
    async ({ projectId }) => {
        try {
            if (projectId) {
                // @ts-ignore - Known issue with the type definitions
                const sections = await todoistApi.getSections({ projectId });
                return { content: [{ type: "text", text: JSON.stringify({ sections }, null, 2) }] };
            } else {
                return { content: [{ type: "text", text: JSON.stringify({ sections: [] }, null, 2) }] };
            }
        } catch (error) {
            console.error('Error fetching sections:', error);
            return {
                content: [{ type: "text", text: "Failed to fetch sections" }],
                isError: true
            };
        }
    }
);

server.tool(
    "getSection",
    {
        description: "Get details of a specific section by its ID.",
        sectionId: z.string().describe("The ID of the section to retrieve")
    },
    async ({ sectionId }) => {
        try {
            const section = await todoistApi.getSection(sectionId);
            return { content: [{ type: "text", text: JSON.stringify({ section }, null, 2) }] };
        } catch (error) {
            console.error('Error fetching section:', error);
            return {
                content: [{ type: "text", text: "Failed to fetch section" }],
                isError: true
            };
        }
    }
);

server.tool(
    "createSection",
    {
        description: "Create a new section within a project.",
        name: z.string().describe("The name of the section (required)"),
        projectId: z.string().describe("The ID of the project to create the section in (required)"),
        order: z.number().optional().describe("Position of the section in the project")
    },
    async (params) => {
        try {
            const section = await todoistApi.addSection({
                name: params.name,
                projectId: params.projectId,
                order: params.order,
            });
            return { content: [{ type: "text", text: JSON.stringify({ section }, null, 2) }] };
        } catch (error) {
            console.error('Error creating section:', error);
            return {
                content: [{ type: "text", text: "Failed to create section" }],
                isError: true
            };
        }
    }
);

server.tool(
    "updateSection",
    {
        description: "Update the name of an existing section.",
        sectionId: z.string().describe("The ID of the section to update"),
        name: z.string().describe("The new name for the section")
    },
    async ({ sectionId, name }) => {
        try {
            const success = await todoistApi.updateSection(sectionId, { name });
            return { content: [{ type: "text", text: JSON.stringify({ success }, null, 2) }] };
        } catch (error) {
            console.error('Error updating section:', error);
            return {
                content: [{ type: "text", text: "Failed to update section" }],
                isError: true
            };
        }
    }
);

server.tool(
    "deleteSection",
    {
        description: "Delete a section (tasks in the section will be moved to the project's main area).",
        sectionId: z.string().describe("The ID of the section to delete")
    },
    async ({ sectionId }) => {
        try {
            const success = await todoistApi.deleteSection(sectionId);
            return { content: [{ type: "text", text: JSON.stringify({ success }, null, 2) }] };
        } catch (error) {
            console.error('Error deleting section:', error);
            return {
                content: [{ type: "text", text: "Failed to delete section" }],
                isError: true
            };
        }
    }
);

// Comments
server.tool(
    "listComments",
    {
        description: "List comments for a specific task or project.",
        taskId: z.string().optional().describe("Task ID to get comments for (either taskId or projectId required)"),
        projectId: z.string().optional().describe("Project ID to get comments for (either taskId or projectId required)")
    },
    async (params) => {
        try {
            if (!params.taskId && !params.projectId) {
                return {
                    content: [{ type: "text", text: "Either taskId or projectId is required" }],
                    isError: true
                };
            }

            let comments;
            if (params.taskId) {
                comments = await todoistApi.getComments({ taskId: params.taskId });
            } else if (params.projectId) {
                comments = await todoistApi.getComments({ projectId: params.projectId });
            }

            return { content: [{ type: "text", text: JSON.stringify({ comments }, null, 2) }] };
        } catch (error) {
            console.error('Error fetching comments:', error);
            return {
                content: [{ type: "text", text: "Failed to fetch comments" }],
                isError: true
            };
        }
    }
);

server.tool(
    "getComment",
    {
        description: "Get details of a specific comment by its ID.",
        commentId: z.string().describe("The ID of the comment to retrieve")
    },
    async ({ commentId }) => {
        try {
            const comment = await todoistApi.getComment(commentId);
            return { content: [{ type: "text", text: JSON.stringify({ comment }, null, 2) }] };
        } catch (error) {
            console.error('Error fetching comment:', error);
            return {
                content: [{ type: "text", text: "Failed to fetch comment" }],
                isError: true
            };
        }
    }
);

server.tool(
    "createComment",
    {
        description: "Create a new comment on a task or project.",
        content: z.string().describe("The comment content (required)"),
        taskId: z.string().optional().describe("Task ID to comment on (either taskId or projectId required)"),
        projectId: z.string().optional().describe("Project ID to comment on (either taskId or projectId required)"),
        attachment: z.object({
            fileName: z.string().optional().describe("Name of the attached file"),
            fileUrl: z.string().describe("URL of the attached file"),
            fileType: z.string().optional().describe("MIME type of the file"),
            resourceType: z.string().optional().describe("Type of resource")
        }).optional().describe("Optional file attachment")
    },
    async (params) => {
        try {
            if (!params.taskId && !params.projectId) {
                return {
                    content: [{ type: "text", text: "Either taskId or projectId is required" }],
                    isError: true
                };
            }

            const commentArgs: any = {
                content: params.content
            };

            if (params.taskId) {
                commentArgs.taskId = params.taskId;
            } else if (params.projectId) {
                commentArgs.projectId = params.projectId;
            }

            if (params.attachment) {
                commentArgs.attachment = params.attachment;
            }

            const comment = await todoistApi.addComment(commentArgs);
            return { content: [{ type: "text", text: JSON.stringify({ comment }, null, 2) }] };
        } catch (error) {
            console.error('Error creating comment:', error);
            return {
                content: [{ type: "text", text: "Failed to create comment" }],
                isError: true
            };
        }
    }
);

server.tool(
    "updateComment",
    {
        description: "Update the content of an existing comment.",
        commentId: z.string().describe("The ID of the comment to update"),
        content: z.string().describe("The new comment content")
    },
    async ({ commentId, content }) => {
        try {
            const success = await todoistApi.updateComment(commentId, { content });
            return { content: [{ type: "text", text: JSON.stringify({ success }, null, 2) }] };
        } catch (error) {
            console.error('Error updating comment:', error);
            return {
                content: [{ type: "text", text: "Failed to update comment" }],
                isError: true
            };
        }
    }
);

server.tool(
    "deleteComment",
    {
        description: "Delete a comment permanently.",
        commentId: z.string().describe("The ID of the comment to delete")
    },
    async ({ commentId }) => {
        try {
            const success = await todoistApi.deleteComment(commentId);
            return { content: [{ type: "text", text: JSON.stringify({ success }, null, 2) }] };
        } catch (error) {
            console.error('Error deleting comment:', error);
            return {
                content: [{ type: "text", text: "Failed to delete comment" }],
                isError: true
            };
        }
    }
);

// Labels
server.tool(
    "listLabels",
    {
        description: "List all labels in your Todoist account. Labels help categorize and filter tasks."
    },
    async () => {
        try {
            const labels = await todoistApi.getLabels();
            return { content: [{ type: "text", text: JSON.stringify({ labels }, null, 2) }] };
        } catch (error) {
            console.error('Error fetching labels:', error);
            return {
                content: [{ type: "text", text: "Failed to fetch labels" }],
                isError: true
            };
        }
    }
);

server.tool(
    "getLabel",
    {
        description: "Get details of a specific label by its ID.",
        labelId: z.string().describe("The ID of the label to retrieve")
    },
    async ({ labelId }) => {
        try {
            const label = await todoistApi.getLabel(labelId);
            return { content: [{ type: "text", text: JSON.stringify({ label }, null, 2) }] };
        } catch (error) {
            console.error('Error fetching label:', error);
            return {
                content: [{ type: "text", text: "Failed to fetch label" }],
                isError: true
            };
        }
    }
);

server.tool(
    "createLabel",
    {
        description: "Create a new label for organizing tasks.",
        name: z.string().describe("The name of the label (required)"),
        color: z.string().optional().describe("Label color (e.g., 'red', 'blue', 'green')"),
        order: z.number().optional().describe("Position in the label list"),
        isFavorite: z.boolean().optional().describe("Whether to mark as favorite")
    },
    async (params) => {
        try {
            const label = await todoistApi.addLabel({
                name: params.name,
                color: params.color,
                order: params.order,
                isFavorite: params.isFavorite,
            });
            return { content: [{ type: "text", text: JSON.stringify({ label }, null, 2) }] };
        } catch (error) {
            console.error('Error creating label:', error);
            return {
                content: [{ type: "text", text: "Failed to create label" }],
                isError: true
            };
        }
    }
);

server.tool(
    "updateLabel",
    {
        description: "Update an existing label.",
        labelId: z.string().describe("The ID of the label to update"),
        name: z.string().optional().describe("New label name"),
        color: z.string().optional().describe("New label color"),
        order: z.number().optional().describe("New position in the label list"),
        isFavorite: z.boolean().optional().describe("Whether to mark as favorite")
    },
    async (params) => {
        try {
            const { labelId, ...updateParams } = params;
            const success = await todoistApi.updateLabel(labelId, updateParams);
            return { content: [{ type: "text", text: JSON.stringify({ success }, null, 2) }] };
        } catch (error) {
            console.error('Error updating label:', error);
            return {
                content: [{ type: "text", text: "Failed to update label" }],
                isError: true
            };
        }
    }
);

server.tool(
    "deleteLabel",
    {
        description: "Delete a label (it will be removed from all tasks that use it).",
        labelId: z.string().describe("The ID of the label to delete")
    },
    async ({ labelId }) => {
        try {
            const success = await todoistApi.deleteLabel(labelId);
            return { content: [{ type: "text", text: JSON.stringify({ success }, null, 2) }] };
        } catch (error) {
            console.error('Error deleting label:', error);
            return {
                content: [{ type: "text", text: "Failed to delete label" }],
                isError: true
            };
        }
    }
);

// Shared Labels
server.tool(
    "getSharedLabels",
    {
        description: "Get labels shared across team workspaces.",
        omitPersonal: z.boolean().optional().describe("Whether to exclude personal labels from results")
    },
    async ({ omitPersonal }) => {
        try {
            const accessToken = await refreshTokenIfNeeded();
            const url = new URL('https://api.todoist.com/rest/v2/labels/shared');
            if (omitPersonal) {
                url.searchParams.append('omit_personal', 'true');
            }

            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to get shared labels: ${response.statusText}`);
            }

            const labels = await response.json();
            return { content: [{ type: "text", text: JSON.stringify({ labels }, null, 2) }] };
        } catch (error) {
            console.error('Error getting shared labels:', error);
            return {
                content: [{ type: "text", text: "Failed to get shared labels" }],
                isError: true
            };
        }
    }
);

server.tool(
    "renameSharedLabel",
    {
        description: "Rename a shared label across team workspaces.",
        name: z.string().describe("Current name of the shared label"),
        newName: z.string().describe("New name for the shared label")
    },
    async ({ name, newName }) => {
        try {
            const accessToken = await refreshTokenIfNeeded();
            const response = await fetch('https://api.todoist.com/rest/v2/labels/shared/rename', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name,
                    new_name: newName
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to rename shared label: ${response.statusText}`);
            }

            return { content: [{ type: "text", text: JSON.stringify({ success: true }, null, 2) }] };
        } catch (error) {
            console.error('Error renaming shared label:', error);
            return {
                content: [{ type: "text", text: "Failed to rename shared label" }],
                isError: true
            };
        }
    }
);

server.tool(
    "removeSharedLabel",
    {
        description: "Remove a shared label from team workspaces.",
        name: z.string().describe("Name of the shared label to remove")
    },
    async ({ name }) => {
        try {
            const accessToken = await refreshTokenIfNeeded();
            const response = await fetch('https://api.todoist.com/rest/v2/labels/shared/remove', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to remove shared label: ${response.statusText}`);
            }

            return { content: [{ type: "text", text: JSON.stringify({ success: true }, null, 2) }] };
        } catch (error) {
            console.error('Error removing shared label:', error);
            return {
                content: [{ type: "text", text: "Failed to remove shared label" }],
                isError: true
            };
        }
    }
);

// Start the stdio server
const transport = new StdioServerTransport();

async function main() {
    try {
        await initializeTodoistApi();
        await server.connect(transport);
        console.error("Todoist MCP Server started with Nango authentication");
    } catch (error) {
        console.error("Failed to start MCP server:", error);
        process.exit(1);
    }
}

main();
