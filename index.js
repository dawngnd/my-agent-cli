#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import inquirer from 'inquirer';
import pc from 'picocolors';
import { program } from 'commander';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sourceDir = path.join(__dirname, 'templates');
const destDir = process.cwd();

// Phân tích URL Github hoặc chuỗi dạng owner/repo
function parseGitHubUrl(url) {
  const regex = /^(?:https?:\/\/github\.com\/)?([^/]+)\/([^/]+)(?:\/.*)?$/;
  const match = url.match(regex);
  if (match) {
    return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
  }
  return null;
}

// Trích xuất Description từ Markdown Frontmatter
function extractDescription(content) {
  if (!content) return '';
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (match) {
    const frontmatter = match[1];
    const descMatch = frontmatter.match(/description:\s*(.*)/);
    if (descMatch) {
      return descMatch[1].replace(/^["']|["']$/g, '').trim();
    }
  }
  return '';
}

// Căn trái và thêm mô tả (description) sử dụng màu xám
function formatDisplay(name, desc) {
  const paddedName = name.padEnd(25);
  if (desc) {
    return `${paddedName} ${pc.italic(pc.gray(desc))}`;
  }
  return name;
}

// Xử lý logic gỡ cài đặt (clean)
async function handleClean() {
  console.log(pc.cyan(pc.bold('🧹 Agent Profiles Cleanup Mode\n')));

  const rulesPath = path.join(destDir, '.agent');
  const workflowsPath = path.join(destDir, '.agent', 'workflows');
  const skillsPath = path.join(destDir, '.agents', 'skills');

  let rules = [];
  let workflows = [];
  let skills = [];

  if (fs.existsSync(rulesPath)) {
    rules = fs.readdirSync(rulesPath, { withFileTypes: true })
      .filter(i => i.isFile() && i.name.endsWith('.md'))
      .map(i => ({ name: i.name, value: `.agent/${i.name}` }));
  }

  if (fs.existsSync(workflowsPath)) {
    workflows = fs.readdirSync(workflowsPath, { withFileTypes: true })
      .filter(i => i.isFile() && i.name.endsWith('.md'))
      .map(i => ({ name: i.name, value: `.agent/workflows/${i.name}` }));
  }

  if (fs.existsSync(skillsPath)) {
    skills = fs.readdirSync(skillsPath, { withFileTypes: true })
      .filter(i => i.isDirectory())
      .map(i => ({ name: i.name, value: `.agents/skills/${i.name}` }));
  }

  const choices = [];
  if (rules.length > 0) {
    choices.push(new inquirer.Separator(pc.bold(pc.magenta('--- 📌 Rules (.agent/) ---'))));
    choices.push(...rules);
  }
  if (workflows.length > 0) {
    choices.push(new inquirer.Separator(pc.bold(pc.magenta('--- ⚙️ Workflows (.agent/workflows/) ---'))));
    choices.push(...workflows);
  }
  if (skills.length > 0) {
    choices.push(new inquirer.Separator(pc.bold(pc.magenta('--- 🧠 Skills (.agents/skills/) ---'))));
    choices.push(...skills);
  }

  if (choices.length === 0) {
    console.log(pc.yellow('No installed Rules/Workflows/Skills found in the current project.'));
    return;
  }

  const answers = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selectedPaths',
      message: 'Select (Space) the items you want to REMOVE from the project, press Enter to confirm:',
      choices: choices,
      pageSize: 15
    }
  ]);

  const selectedPaths = answers.selectedPaths || [];
  if (selectedPaths.length === 0) {
    console.log(pc.yellow('⚠️ No items selected for removal. Operation cancelled.'));
    return;
  }

  console.log(pc.blue('\n⏳ Removing selected items...'));

  for (const relPath of selectedPaths) {
    const targetPath = path.join(destDir, relPath);
    if (fs.existsSync(targetPath)) {
      fs.rmSync(targetPath, { recursive: true, force: true });
      console.log(pc.red(`  ✖ Removed: `) + relPath);
    }
  }

  console.log(pc.green(pc.bold('\n🎉 Cleanup complete!')));
}

async function run() {
  program
    .name('my-agent-cli')
    .description(pc.yellow('CLI to download Rules, Workflows, and Skills for your AI Agent\n') +
      'A tool to quickly import .agent and .agents/skills directories into your current project ' +
      'so AI assistants (like Antigravity/Cursor/Cline) can utilize them.')
    .version('1.0.0', '-v, --version', 'Show the current version')
    .option('-r, --repo <url>', 'URL to the GitHub Repository containing templates (e.g., user/repo or https://github.com/user/repo)')
    .option('-c, --clean', 'Uninstall (remove) existing rules, workflows, skills from the project')
    .addHelpText('after', `
Usage Examples:
  $ my-agent-cli                            (Install from the local 'templates' directory by default)
  $ my-agent-cli --repo owner/my-repo       (Download directly from a GitHub repository)
  $ my-agent-cli -r https://github.com/owner/my-repo
  $ my-agent-cli --clean                    (Uninstall / clean AI configurations)
    `);

  program.parse(process.argv);
  const options = program.opts();

  if (options.clean) {
    await handleClean();
    return;
  }

  console.log(pc.cyan(pc.bold('🤖 Welcome to the Agent Profiles Installer!\n')));

  let rules = [];
  let workflows = [];
  let skills = [];

  // Dành riêng cho Github flow
  let isGithub = false;
  let repoInfo = null;
  let branchName = 'main';
  let githubFilesMap = {};

  if (options.repo) {
    isGithub = true;
    repoInfo = parseGitHubUrl(options.repo);

    if (!repoInfo) {
      console.log(pc.red('❌ Invalid GitHub URL. Please format as owner/repo or use a full URL.'));
      return;
    }

    console.log(pc.blue(`⏳ Analyzing structure from GitHub Repository: ${repoInfo.owner}/${repoInfo.repo}...`));

    try {
      // 1. Lấy thông tin Repo để biết default branch
      const repoRes = await axios.get(`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}`, {
        headers: { 'User-Agent': 'my-agent-cli' }
      });
      branchName = repoRes.data.default_branch;

      // 2. Lấy toàn bộ cây thư mục để lên danh sách file
      const treeRes = await axios.get(`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/git/trees/${branchName}?recursive=1`, {
        headers: { 'User-Agent': 'my-agent-cli' }
      });
      const tree = treeRes.data.tree;

      let rulesSet = new Map();
      let workflowsSet = new Map();
      let skillsSet = new Map();

      tree.forEach(item => {
        if (item.type !== 'blob') return; // Chỉ lấy file

        // Lưu trữ URL để fetch file trực tiếp sau khi chọn
        const rawUrl = `https://raw.githubusercontent.com/${repoInfo.owner}/${repoInfo.repo}/${branchName}/${item.path}`;
        githubFilesMap[item.path] = rawUrl;

        // Lọc .agent/*.md
        if (/^\.agent\/[^/]+\.md$/.test(item.path)) {
          const basename = item.path.split('/').pop();
          rulesSet.set(basename, { value: `.agent/${basename}`, url: rawUrl });
        }

        // Lọc .agent/workflows/*
        if (item.path.startsWith('.agent/workflows/') && item.path.endsWith('.md')) {
          const basename = item.path.split('/').pop();
          workflowsSet.set(basename, { value: `.agent/workflows/${basename}`, url: rawUrl });
        }

        // Lọc .agents/skills/* (tìm file SKILL.md trực tiếp)
        if (item.path.startsWith('.agents/skills/') && item.path.endsWith('SKILL.md')) {
          const parts = item.path.split('/');
          if (parts.length >= 4) {
            const skillName = parts[2];
            skillsSet.set(skillName, { value: `.agents/skills/${skillName}`, url: rawUrl });
          }
        }
      });

      console.log(pc.blue(`⏳ Fetching detailed descriptions for files...`));

      // 3. Đọc nội dung file tạm thời để lấy Description
      async function mapWithDescription(filesMap) {
        const promises = Array.from(filesMap.entries()).map(async ([name, data]) => {
          try {
            const res = await axios.get(data.url, { responseType: 'text' });
            const desc = extractDescription(res.data);
            return { name: formatDisplay(name, desc), value: data.value };
          } catch {
            return { name: formatDisplay(name, ''), value: data.value };
          }
        });
        return Promise.all(promises);
      }

      rules = await mapWithDescription(rulesSet);
      workflows = await mapWithDescription(workflowsSet);
      skills = await mapWithDescription(skillsSet);

      console.log(pc.green(`✔ Analysis complete!\n`));

    } catch (err) {
      console.error(pc.red('❌ Error fetching data from GitHub:'), err.response?.data?.message || err.message);
      if (err.response?.status === 404) {
        console.error(pc.yellow('Repository does not exist or is Private. Please verify the URL.'));
      }
      return;
    }

  } else {
    // Local flow
    const rulesPath = path.join(sourceDir, '.agent');
    const workflowsPath = path.join(sourceDir, '.agent', 'workflows');
    const skillsPath = path.join(sourceDir, '.agents', 'skills');

    if (fs.existsSync(rulesPath)) {
      rules = fs.readdirSync(rulesPath, { withFileTypes: true })
        .filter(i => i.isFile() && i.name.endsWith('.md'))
        .map(i => {
          let desc = '';
          try {
            desc = extractDescription(fs.readFileSync(path.join(rulesPath, i.name), 'utf-8'));
          } catch (e) { }
          return { name: formatDisplay(i.name, desc), value: `.agent/${i.name}` };
        });
    }

    if (fs.existsSync(workflowsPath)) {
      workflows = fs.readdirSync(workflowsPath, { withFileTypes: true })
        .filter(i => i.isFile() && i.name.endsWith('.md'))
        .map(i => {
          let desc = '';
          try {
            desc = extractDescription(fs.readFileSync(path.join(workflowsPath, i.name), 'utf-8'));
          } catch (e) { }
          return { name: formatDisplay(i.name, desc), value: `.agent/workflows/${i.name}` };
        });
    }

    if (fs.existsSync(skillsPath)) {
      skills = fs.readdirSync(skillsPath, { withFileTypes: true })
        .filter(i => i.isDirectory())
        .map(i => {
          let desc = '';
          try {
            const skillMdPath = path.join(skillsPath, i.name, 'SKILL.md');
            if (fs.existsSync(skillMdPath)) {
              desc = extractDescription(fs.readFileSync(skillMdPath, 'utf-8'));
            }
          } catch (e) { }
          return { name: formatDisplay(i.name, desc), value: `.agents/skills/${i.name}` };
        });
    }
  }
  const totalFound = rules.length + workflows.length + skills.length;

  // Loại bỏ những file/thư mục đã tồn tại trong dự án (đã cài đặt)
  rules = rules.filter(item => !fs.existsSync(path.join(destDir, item.value)));
  workflows = workflows.filter(item => !fs.existsSync(path.join(destDir, item.value)));
  skills = skills.filter(item => !fs.existsSync(path.join(destDir, item.value)));

  const choices = [];

  if (rules.length > 0) {
    choices.push(new inquirer.Separator(pc.bold(pc.magenta('--- 📌 Rules (.agent/) ---'))));
    choices.push(...rules);
  }

  if (workflows.length > 0) {
    choices.push(new inquirer.Separator(pc.bold(pc.magenta('--- ⚙️ Workflows (.agent/workflows/) ---'))));
    choices.push(...workflows);
  }

  if (skills.length > 0) {
    choices.push(new inquirer.Separator(pc.bold(pc.magenta('--- 🧠 Skills (.agents/skills/) ---'))));
    choices.push(...skills);
  }

  if (choices.length === 0) {
    if (totalFound > 0) {
      console.log(pc.green('✔ All available templates (Rules/Workflows/Skills) are already completely installed in this project.'));
    } else {
      console.log(pc.red(isGithub
        ? 'No valid template structures (Rules/Workflows/Skills) found in this GitHub Repository.'
        : 'No templates found in the local templates directory. You need to copy .agent and .agents folders into templates/ directory.'));
    }
    return;
  }

  const answers = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selectedPaths',
      message: 'Select (Space) the items you want to install, press Enter to confirm:',
      choices: choices,
      pageSize: 15
    }
  ]);

  const selectedPaths = answers.selectedPaths || [];

  if (selectedPaths.length === 0) {
    console.log(pc.yellow('⚠️ No items selected. Operation cancelled.'));
    return;
  }

  console.log(pc.blue('\n⏳ Installing...'));

  for (const relPath of selectedPaths) {
    if (isGithub) {
      // Download file trực tiếp từ GitHub
      const filePathsToDownload = Object.keys(githubFilesMap).filter(p => p === relPath || p.startsWith(relPath + '/'));
      for (const filePath of filePathsToDownload) {
        const dest = path.join(destDir, filePath);
        const rawUrl = githubFilesMap[filePath];

        try {
          const resp = await axios.get(rawUrl, { responseType: 'arraybuffer' });
          const parentDir = path.dirname(dest);
          if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });

          fs.writeFileSync(dest, resp.data);
        } catch (err) {
          console.error(pc.red(`  ✖ Error downloading file: ${filePath}`));
        }
      }
      console.log(pc.green(`  ✔ Downloaded: `) + relPath);
    } else {
      // Sao chép từ local templates
      const src = path.join(sourceDir, relPath);
      const dest = path.join(destDir, relPath);

      if (fs.existsSync(src)) {
        const destParent = path.dirname(dest);
        if (!fs.existsSync(destParent)) {
          fs.mkdirSync(destParent, { recursive: true });
        }

        fs.cpSync(src, dest, { recursive: true });
        console.log(pc.green(`  ✔ Copied: `) + relPath);
      }
    }
  }

  console.log(pc.green(pc.bold('\n🎉 Done! Your code is now ready for the AI Assistant.')));
}

run().catch(err => {
  if (err.isTtyError || err.name === 'ExitPromptError') return;
  console.error(pc.red('An error occurred:'), err);
});
