# my-agent-cli

`my-agent-cli` is a powerful command-line interface tool designed to help developers quickly download and set up AI Agent profiles, including **Rules, Workflows, and Skills**. 

It works seamlessly by importing structured directories (`.agent` and `.agents/skills`) into your current project, making your codebase entirely ready for AI assistants like Antigravity, Cursor, or Cline.

## Features

- **GitHub Repository Integration**: Directly fetch configurations from any connected GitHub repository containing templates without needing to download them locally.
- **Interactive Checklist**: Displays an intuitive, color-coded, and categorized checklist in your terminal to easily select the rules or skills you want to install.
- **Smart Filtering**: Automatically hides templates you have already installed in your current project.
- **Frontmatter Descriptions**: Reads and displays the `description` attribute from YAML Frontmatter directly in the CLI prompt, helping you understand the utility of each file before downloading.
- **Cleanup Mode**: Easily cleanly uninstall and wipe previous templates from your project by providing a `--clean` flag.

## Installation

You can run this CLI tool without installing it globally using `npx`:

```bash
npx my-agent-cli [options]
```

Or you can install it globally on your system:

```bash
npm install -g my-agent-cli
```

## Usage Examples

Here are the primary ways to utilize `my-agent-cli`:

### Download directly from a GitHub repository
To pull rules and skills from an existing repository on GitHub, use the `--repo` or `-r` flag:

```bash
my-agent-cli -r owner/my-repo
```
*Alternatively, you can provide the full URL:*
```bash
my-agent-cli --repo https://github.com/owner/my-repo
```

### Install from a local directory
If you have a local `templates` directory next to the CLI tool codebase containing `.agent` and `.agents` folders, simply run it without flags:

```bash
my-agent-cli
```

### Cleanup Mode
If you want to quickly remove all existing agent configurations from your current project's working directory, you can run the cleanup command:

```bash
my-agent-cli --clean
# or
my-agent-cli -c
```

## Template Directory Structure Requirement

For `my-agent-cli` to work, the source (either local or GitHub repository) must follow this basic structure:

```text
/
├── .agent/                    # Your base/global rules
│   ├── default-rules.md
│   └── workflows/             # Your multi-step instructional workflows
│       └── auto-test.md
└── .agents/
    └── skills/                # Your specific technology skills
        └── java-testing/
            └── SKILL.md
```

Each Markdown file should ideally include YAML frontmatter at the top to describe what it does:

```markdown
---
description: This is a short description about what this rule/skill does.
---
# The rest of the content...
```