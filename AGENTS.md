# Project Guidelines

## Stack

- React 19 with JavaScript and JSX.
- Vite 6 with `@vitejs/plugin-react`.
- npm for dependency management and scripts.

## Folder layout

- `index.html`: Vite HTML entry point.
- `src/main.jsx`: React mount point and global stylesheet import.
- `src/App.jsx`: Root application component and application state.
- `src/style.css`: Global styles.
- `vite.config.js`: Vite configuration.
- `prompts.md`: Reusable development prompt templates.

Keep new UI components in `src/`, with one component per file.

## Commands

Run these from the project root:

| Purpose | Command |
| --- | --- |
| Install dependencies | `npm install` |
| Start development server | `npm run dev` |
| Build for production | `npm run build` |
| Preview production build | `npm run preview` |

There are currently no test or lint scripts configured in `package.json`.
Do not report tests or lint as passing unless a corresponding command has been
added and run.

## Conventions

- Keep application state in `src/App.jsx`; pass data and callbacks to child
  components through props.
- Put each React component in its own file.
- Follow the existing JavaScript, JSX, and CSS patterns; avoid adding a
  framework or dependency without approval.
- Preserve existing behavior and run the production build after code changes.

## Workflow

- Make changes on a task-specific branch. If the workspace is not a Git
  repository or a branch cannot be used, report that constraint rather than
  initializing a repository or changing branches without approval.
- Summarize the changes and validation performed in the pull request.
