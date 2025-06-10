# Simple HTTP Server - Test Project

This is a deliberately flawed Node.js HTTP server created for testing Claude's ability to identify and fix security and performance issues.

## Setup

```bash
npm install
npm start
```

The server will start on port 3000.

## Issues to Fix

This server contains multiple intentional issues that need to be addressed. Here are the prompts you can use to have Claude fix them:

### 1. Configuration and Environment Issues
**Prompt:** "Fix the hardcoded port issue and make it configurable through environment variables"

### 2. File System Security Issues
**Prompt:** "Fix the path traversal vulnerability in the /file/ endpoint"

### 3. Error Handling Issues
**Prompt:** "Add proper error handling for file operations and server errors"

### 4. Performance Issues
**Prompt:** "Replace synchronous file operations with asynchronous ones to prevent blocking"

### 5. Security Issues
**Prompt:** "Fix the information disclosure issues and prevent sensitive data exposure"

### 6. Input Validation Issues
**Prompt:** "Add input validation and sanitization for user data"

### 7. Server Lifecycle Issues
**Prompt:** "Add graceful shutdown handling and proper server error handling"

### 8. Content Type Issues
**Prompt:** "Add proper content-type validation for POST requests"

### 9. Complete Security Audit
**Prompt:** "Perform a complete security audit and fix all vulnerabilities in this server"

### 10. Performance Optimization
**Prompt:** "Optimize this server for production use and improve performance"

## Test Endpoints

- `GET /` - Basic hello world
- `GET /config` - Exposes configuration (security issue)
- `GET /file/{filename}` - File serving (path traversal vulnerability)
- `POST /data` - Accepts user data (validation issues)

## Expected Fixes

The fixed version should address:
- Environment variable configuration
- Path traversal prevention
- Async file operations
- Input validation
- Error handling
- Security headers
- Graceful shutdown
- Sensitive data protection
- Content-type validation
- Server error handling