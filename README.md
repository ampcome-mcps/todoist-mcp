# Todoist MCP Server

MCP server for Todoist API with Nango authentication.

## Features

- ✅ Works with `npx` without committing built files
- ✅ Automatic build on installation
- ✅ Nango OAuth authentication
- ✅ Full Todoist API integration
- ✅ Comprehensive task, project, and label management

## Quick Start

### Using npx (Recommended)
```bash
npx -y git+https://github.com/ampcome-mcps/todoist-mcp.git
```

### Using Docker
```bash
docker build -t todoist-mcp .
docker run -it --rm \
  -e NANGO_CONNECTION_ID="your_connection_id" \
  -e NANGO_INTEGRATION_ID="your_integration_id" \
  -e NANGO_BASE_URL="https://api.nango.dev" \
  -e NANGO_SECRET_KEY="your_secret_key" \
  todoist-mcp
```

### Local Development
```bash
git clone https://github.com/ampcome-mcps/todoist-mcp.git
cd todoist-mcp
npm install
npm run build
npm start
```

## Configuration

Set these environment variables:

```bash
NANGO_CONNECTION_ID=your_connection_id
NANGO_INTEGRATION_ID=your_integration_id
NANGO_BASE_URL=https://api.nango.dev
NANGO_SECRET_KEY=your_secret_key
```

## Claude Desktop Configuration

```json
{
  "mcpServers": {
    "todoist": {
      "command": "npx",
      "args": ["-y", "git+https://github.com/ampcome-mcps/todoist-mcp.git"],
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

## Available Tools

- `listTasks` - List tasks with filters
- `createTask` - Create new tasks
- `completeTask` - Mark tasks as complete
- `listProjects` - List all projects
- `createProject` - Create new projects
- `listLabels` - List all labels
- `createLabel` - Create new labels

## Troubleshooting

### Build Issues
If you encounter build issues:
```bash
# Clear node_modules and reinstall
rm -rf node_modules
npm install

# Manual build
npm run build
```

### Permission Issues
If you get permission errors:
```bash
# Make sure bin script is executable
chmod +x bin/todoist-mcp.js

# Or run directly with node
node bin/todoist-mcp.js
```

### Testing
```bash
# Run various tests
npm test              # Basic functionality test
npm run test:npx      # Simulate npx installation
npm run verify        # Verify setup completeness
```
