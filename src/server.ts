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
        console.error('✅ Todoist API initialized with Nango authentication');
    } catch (error) {
        console.error('❌ Failed to initialize Todoist API with Nango:', error);
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
    version: "1.0.7"
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
    "createTask",
    {
        description: "Create a new task in Todoist with various optional parameters.",
        content: z.string().describe("The task content/title (required)"),
        projectId: z.string().optional().describe("Project ID to add the task to"),
        dueString: z.string().optional().describe("Due date in natural language (e.g., 'today', 'tomorrow', 'next Monday')"),
        priority: z.number().optional().describe("Priority level (1-4, where 4 is highest)"),
        labels: z.array(z.string()).optional().describe("Array of label names to assign to the task"),
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
    "createProject",
    {
        description: "Create a new project in Todoist.",
        name: z.string().describe("The name of the project (required)"),
        color: z.string().optional().describe("Project color (e.g., 'red', 'blue', 'green')"),
        isFavorite: z.boolean().optional().describe("Whether to mark as favorite")
    },
    async (params) => {
        try {
            const project = await todoistApi.addProject({
                name: params.name,
                color: params.color,
                isFavorite: params.isFavorite
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
    "createLabel",
    {
        description: "Create a new label for organizing tasks.",
        name: z.string().describe("The name of the label (required)"),
        color: z.string().optional().describe("Label color (e.g., 'red', 'blue', 'green')"),
        isFavorite: z.boolean().optional().describe("Whether to mark as favorite")
    },
    async (params) => {
        try {
            const label = await todoistApi.addLabel({
                name: params.name,
                color: params.color,
                isFavorite: params.isFavorite
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

// Start the stdio server
const transport = new StdioServerTransport();

async function main() {
    try {
        await initializeTodoistApi();
        await server.connect(transport);
        console.error("🚀 Todoist MCP Server started successfully with Nango authentication");
    } catch (error) {
        console.error("❌ Failed to start MCP server:", error);
        process.exit(1);
    }
}

main();
