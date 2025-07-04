# Todoist MCP Server

[![smithery badge](https://smithery.ai/badge/@stevengonsalvez/todoist-mcp)](https://smithery.ai/server/@stevengonsalvez/todoist-mcp)

A Model Context Protocol (MCP) server for Todoist, enabling advanced task and project management via Claude Desktop and other MCP-compatible clients.

## Requirements
- Node.js (v18 or higher recommended)
- npm or yarn
- A Todoist account
- Nango authentication setup (see Configuration section)

## Features
- List, create, update, complete, reopen, and delete tasks
- List, create, update, archive, unarchive, and delete projects
- List, create, update, and delete sections
- List, create, update, and delete labels
- List, create, update, and delete comments
- Manage shared labels
- Fetch project collaborators

## All Features
- **Tasks**: List, get, create, update, complete, reopen, delete
- **Projects**: List, get, create, update, archive, unarchive, delete
- **Sections**: List (by project), get, create, update, delete
- **Labels**: List, get, create, update, delete, manage shared labels
- **Comments**: List (by task/project), get, create, update, delete
- **Collaborators**: List project collaborators

## Configuration

This server uses Nango for authentication. You'll need to set up the following environment variables:

```bash
# Nango Configuration
NANGO_CONNECTION_ID=your_connection_id_here
NANGO_INTEGRATION_ID=your_integration_id_here
NANGO_BASE_URL=https://api.nango.dev
NANGO_SECRET_KEY=your_secret_key_here
```

Create a `.env` file in the project root with these values, or set them as environment variables.

### Setting up Nango Authentication

1. **Create a Nango Account**: Sign up at [nango.dev](https://nango.dev)
2. **Configure Todoist Integration**: Set up Todoist as an integration in your Nango dashboard
3. **Get Your Credentials**: 
   - `NANGO_CONNECTION_ID`: Your specific connection ID for Todoist
   - `NANGO_INTEGRATION_ID`: Your integration/provider config key
   - `NANGO_SECRET_KEY`: Your Nango secret key
   - `NANGO_BASE_URL`: Usually `https://api.nango.dev`
4. **Complete OAuth Flow**: Use Nango's OAuth flow to authenticate with Todoist

## Installation

### For Claude Desktop (JSON)
If published as an npm package, you can use it directly with npx in your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "todoist": {
      "command": "npx",
      "args": [
        "todoist-mcp"
      ],
      "env": {
        "NANGO_CONNECTION_ID": "your_connection_id",
        "NANGO_INTEGRATION_ID": "your_integration_id", 
        "NANGO_BASE_URL": "https://api.nango.dev",
        "NANGO_SECRET_KEY": "your_secret_key"
      }
    }
  }
}
```

### Manual Installation
1. Clone the repository:
   ```sh
   git clone https://github.com/yourusername/todoist-mcp.git
   cd todoist-mcp
   ```
2. Install dependencies:
   ```sh
   npm install
   # or
   yarn install
   ```
3. Build the project:
   ```sh
   npm run build
   # or
   yarn build
   ```
4. Set your Nango environment variables (see Configuration section above).
5. Run the built server:
   ```sh
   node dist/server.js
   ```
6. Configure Claude Desktop to use your local build by adding this to your config file:
   ```json
   {
     "mcpServers": {
       "todoist": {
         "command": "node",
         "args": [
           "/path/to/todoist-mcp/dist/server.js"
         ],
         "env": {
           "NANGO_CONNECTION_ID": "your_connection_id",
           "NANGO_INTEGRATION_ID": "your_integration_id", 
           "NANGO_BASE_URL": "https://api.nango.dev",
           "NANGO_SECRET_KEY": "your_secret_key"
         }
       }
     }
   }
   ```

## Usage Examples
- **Get top priority tasks:**
  > "Show me my top priority tasks."
- **Create and classify labels:**
  > "Create labels for my tasks and classify them by project or urgency."
- **Organize tasks by section:**
  > "Move all tasks with the label 'urgent' to the 'Today' section."
- **Project management:**
  > "Create a new project called 'Personal Growth' and add a section 'Reading List'."
- **Collaborator overview:**
  > "List all collaborators for the project 'Team Launch'."
- **Comment management:**
  > "Add a comment to the task 'Prepare slides' with the content 'Remember to include Q2 results.'"

## Development

### Running in Development Mode
```sh
npm run dev
# or
yarn dev
```

### Building for Production
```sh
npm run build
# or
yarn build
```

## Authentication Notes

- The server automatically handles token refresh through Nango
- If tokens expire, they will be refreshed automatically
- All API calls use fresh tokens to ensure reliability
- Error handling includes authentication failure recovery

## License
This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
