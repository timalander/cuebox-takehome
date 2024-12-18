# Project Setup Guide

## Installing Bun

### macOS or Linux

```bash
curl -fsSL https://bun.sh/install | bash
```

### Windows

Bun requires Windows Subsystem for Linux (WSL). Follow these steps:

1. Install WSL by running in PowerShell as administrator:

```powershell
wsl --install
```

2. Restart your computer

3. Install Bun in WSL:

```bash
curl -fsSL https://bun.sh/install | bash
```

## Verifying Installation

```bash
bun --version
```

## Project Setup

1. Clone the repository and navigate to the project directory

2. Install dependencies:

```bash
bun install
```

## Running the Project

The project consists of both a frontend and backend that can be run simultaneously using:

```bash
bun run dev
```

Or run them separately:

- Frontend only:

```bash
bun run dev:frontend
```

- Backend only:

```bash
bun run dev:backend
```

## Running Tests

Run all tests:

```bash
bun test
```
