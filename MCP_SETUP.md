# MCP (Model Context Protocol) Setup Guide

## Current Status

✅ **MCP Plugin Enabled**

The MCP plugin (`@payloadcms/plugin-mcp`) is now installed and enabled. Payload CMS has been upgraded to version 3.71.1, and the MCP plugin is configured and active in `payload.config.ts`.

## Configuration

The MCP plugin is configured in `src/payload.config.ts`:

```typescript
import { mcpPlugin } from '@payloadcms/plugin-mcp'

// In plugins array:
mcpPlugin({
  collections: {
    packages: {
      description: 'Property packages for hosts to manage pricing tiers, availability, and booking options',
      enabled: {
        create: true,
        delete: true,
        find: true,
        update: true,
      },
    },
  },
  mcp: {
    handlerOptions: {
      verboseLogs: process.env.NODE_ENV === 'development',
    },
  },
}),
```

## MCP Server Configuration

Once the plugin is enabled, configure your MCP client (e.g., Cursor, Claude Desktop) to connect to the Payload MCP server:

### For Cursor/VS Code MCP Client

Add to your MCP configuration (usually in Cursor settings or `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "Payload": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "http://localhost:3000/api/mcp",
        "--header",
        "Authorization: ae7ebe7c-6429-431e-86f5-b3698a1de18d"
      ]
    }
  }
}
```

### API Key Setup

1. The MCP plugin creates an API Keys collection in Payload admin
2. Create an API key in Payload Admin Panel → Collections → API Keys
3. Use that API key in the `Authorization` header above
4. The API key should be associated with a user who has `host` or `admin` role

### MCP Endpoint

- **Development**: `http://localhost:3000/api/mcp`
- **Production**: `https://simpleplek.com/api/mcp`

## Available MCP Tools
  
Once connected, the MCP client will have access to:

### Package Management Tools
- **Create Package**: Create new packages for properties
- **Update Package**: Modify existing package details
- **Delete Package**: Remove packages
- **Find Packages**: Search and list packages

### Package Fields
- `name`: Package display name
- `description`: Package description
- `category`: standard | hosted | addon | special
- `entitlement`: standard | pro
- `minNights`: Minimum nights required
- `maxNights`: Maximum nights allowed
- `baseRate`: Base rate in cents (ZAR) - e.g., R150.00 = 15000 cents
- `multiplier`: Price multiplier (default: 1)
- `isEnabled`: Enable/disable package
- `post`: Relationship to property (Post collection)

## Usage Example

Once configured, you can use natural language commands in your MCP client:

```
"Create a new standard package for my property called 'Weekend Getaway' 
with a base rate of R200 per night, minimum 2 nights, maximum 3 nights"

"Update the 'Monthly Stay' package to have a base rate of R5000"

"List all packages for property ID xyz123"

"Delete the 'Test Package' package"
```

## Troubleshooting

### Build Errors
- If you see `UnauthorizedError is not exported from 'payload'`, ensure Payload is upgraded to 3.71.1+
- If build fails, check that all Payload packages are on compatible versions

### Connection Issues
- Verify the server is running: `npm run dev`
- Check that `/api/mcp` endpoint is accessible
- Verify API key is correct and user has proper permissions
- Check browser console/network tab for errors

### Permission Issues
- Ensure the API key is associated with a user who has `host` or `admin` role
- Verify collection access controls allow the operations you're trying to perform

## Current Implementation

Even without the MCP plugin enabled, the AI Assistant on the manage page (`/manage`) has been configured to understand MCP capabilities and can guide hosts in package management. The chat API includes context about MCP tools and can provide helpful guidance, though it cannot directly execute MCP operations until the plugin is enabled.

## References

- [Payload MCP Plugin Documentation](https://payloadcms.com/docs/plugins/mcp)
- [Model Context Protocol Specification](https://modelcontextprotocol.io/)

