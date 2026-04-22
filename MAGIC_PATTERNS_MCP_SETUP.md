# Magic Patterns MCP Integration Guide

## Overview

Magic Patterns MCP server allows you to integrate UI designs directly from [Magic Patterns](https://www.magicpatterns.com) into your project using Cursor's MCP (Model Context Protocol) integration.

## Setup Instructions

### 1. Configure MCP Server in Cursor

MCP configuration in Cursor is typically stored in your Cursor settings. To add the Magic Patterns MCP server:

1. **Open Cursor Settings**
   - Press `Cmd+,` (Mac) or `Ctrl+,` (Windows/Linux)
   - Or go to `Cursor > Settings`

2. **Navigate to MCP Settings**
   - Look for "MCP" or "Model Context Protocol" in settings
   - Or search for "mcp" in the settings search bar

3. **Add Magic Patterns Server**
   - Add the following configuration to your MCP servers list:

```json
{
  "mcpServers": {
    "magic-patterns": {
      "url": "https://mcp.magicpatterns.com/mcp"
    }
  }
}
```

**Alternative Configuration Format** (if using a config file):
```json
{
  "magic-patterns": {
    "url": "https://mcp.magicpatterns.com/mcp"
  }
}
```

### 2. Restart Cursor

After adding the MCP server configuration, restart Cursor to initialize the connection.

### 3. Verify Connection

Once configured, you should be able to use prompts like:
```
Integrate this design: https://www.magicpatterns.com/c/1wh8xxmzebpyrnh2nganb3 into my project
```

## Usage Examples

### Basic Integration

```
Integrate this design: https://www.magicpatterns.com/c/[design-id] into my project
```

### Specific Component Integration

```
Integrate the booking carousel component from https://www.magicpatterns.com/c/[design-id] into src/components/Bookings/
```

### With Customization

```
Integrate this design: https://www.magicpatterns.com/c/[design-id] and adapt it to use our existing BookingCard component and teal color scheme
```

## Integration Workflow

1. **Find a Design on Magic Patterns**
   - Browse designs at https://www.magicpatterns.com
   - Copy the design URL (format: `https://www.magicpatterns.com/c/[id]`)

2. **Request Integration**
   - Use the prompt format: `Integrate this design: [URL]`
   - Specify any customizations or requirements

3. **Review Generated Code**
   - The MCP server will provide component code
   - Review and adapt to your project structure
   - Ensure it matches your existing patterns

4. **Test and Refine**
   - Test the integrated components
   - Make adjustments as needed
   - Ensure compatibility with your existing codebase

## Current Project Structure

Your project uses:
- **Next.js** with App Router
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui** components
- **Payload CMS** for content management

### Component Locations

- **Booking Components**: `src/components/Bookings/`
- **UI Components**: `src/components/ui/`
- **Pages**: `src/app/(frontend)/`

### Styling

- **Primary Color**: Teal (`text-teal-400`, `bg-teal-500`)
- **Design System**: shadcn/ui with custom Tailwind config
- **Dark Mode**: Supported via CSS variables

## Example: Integrating a Booking Carousel Design

If you want to integrate a carousel design from Magic Patterns:

```
Integrate this design: https://www.magicpatterns.com/c/[design-id] into src/components/Bookings/BookingCarousel.tsx

Requirements:
- Use our existing BookingCard component
- Match teal color scheme
- Support addon toggles
- Use TypeScript
- Follow our existing component patterns
```

## Troubleshooting

### MCP Server Not Connecting

1. **Check Configuration**
   - Verify the URL is correct: `https://mcp.magicpatterns.com/mcp`
   - Ensure JSON syntax is valid

2. **Check Cursor Version**
   - Ensure you're using a recent version of Cursor
   - MCP support may require Cursor Pro/Enterprise

3. **Restart Cursor**
   - Fully quit and restart Cursor
   - Check Cursor logs for MCP connection errors

### Design Integration Issues

1. **Component Conflicts**
   - Check if component names conflict with existing components
   - Rename imported components if needed

2. **Dependency Issues**
   - Ensure required packages are installed
   - Check for version conflicts

3. **Styling Conflicts**
   - Review Tailwind classes
   - Ensure CSS variables are properly configured
   - Check for dark mode compatibility

## Best Practices

1. **Review Before Integration**
   - Always review generated code
   - Ensure it follows your project's patterns
   - Check for security concerns

2. **Incremental Integration**
   - Start with small components
   - Test thoroughly before integrating larger designs
   - Keep backups of original components

3. **Customization**
   - Adapt designs to match your brand
   - Use your existing component library
   - Maintain consistency with your design system

4. **Documentation**
   - Document any customizations made
   - Note any breaking changes
   - Update component documentation

## Related Files

- Component structure: `src/components/Bookings/`
- UI components: `src/components/ui/`
- Styling: `tailwind.config.mjs`, `src/cssVariables.js`
- Type definitions: `src/payload-types.ts`

## Additional Resources

- [Magic Patterns](https://www.magicpatterns.com)
- [Cursor MCP Documentation](https://cursor.sh/docs)
- [shadcn/ui Components](https://ui.shadcn.com)

