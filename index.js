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
  console.log(pc.cyan(pc.bold('🧹 Chế độ dọn dẹp cấu hình Agent Profiles\n')));

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
    console.log(pc.yellow('Không tìm thấy Rules/Workflows/Skills nào đang được cài đặt trong dự án hiện tại.'));
    return;
  }

  const answers = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selectedPaths',
      message: 'Hãy tích chọn (Space) những nội dung bạn muốn GỠ BỎ khỏi dự án, ấn Enter để xác nhận:',
      choices: choices,
      pageSize: 15
    }
  ]);

  const selectedPaths = answers.selectedPaths || [];
  if (selectedPaths.length === 0) {
    console.log(pc.yellow('⚠️ Bạn chưa chọn mục nào để xoá. Hủy thao tác.'));
    return;
  }

  console.log(pc.blue('\n⏳ Đang tiến hành xoá...'));

  for (const relPath of selectedPaths) {
    const targetPath = path.join(destDir, relPath);
    if (fs.existsSync(targetPath)) {
      fs.rmSync(targetPath, { recursive: true, force: true });
      console.log(pc.red(`  ✖ Đã xoá: `) + relPath);
    }
  }

  console.log(pc.green(pc.bold('\n🎉 Đã dọn dẹp xong!')));
}

async function run() {
  program
    .name('my-agent-cli')
    .description(pc.yellow('CLI để lấy các quy tắc (Rules), quy trình (Workflows), kỹ năng (Skills) về máy cho AI Agent\n') +
      'Công cụ giúp bạn nhanh chóng import thư mục .agent cũng như .agents/skills vào thư mục dự án hiện tại ' +
      'để trợ lý AI (như Antigravity/Cursor/Cline) có thể sử dụng.')
    .version('1.0.0', '-v, --version', 'Hiển thị phiên bản hiện tại')
    .option('-r, --repo <url>', 'Đường dẫn tới GitHub Repository chứa templates (VD: user/repo hoặc https://github.com/user/repo)')
    .option('-c, --clean', 'Gỡ cài đặt (xoá) các rules, workflows, skills hiện có trong dự án')
    .addHelpText('after', `
Ví dụ cách sử dụng:
  $ my-agent-cli                            (Cài đặt từ thư mục cục bộ 'templates' mặc định)
  $ my-agent-cli --repo owner/my-repo       (Download trực tiếp từ thư mục của GitHub repository)
  $ my-agent-cli -r https://github.com/owner/my-repo
  $ my-agent-cli --clean                    (Gỡ bỏ cài đặt / dọn dẹp cấu hình AI)
    `);

  program.parse(process.argv);
  const options = program.opts();

  if (options.clean) {
    await handleClean();
    return;
  }

  console.log(pc.cyan(pc.bold('🤖 Chào mừng đến với công cụ cài đặt Agent Profiles!\n')));

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
      console.log(pc.red('❌ Đường dẫn GitHub không hợp lệ. Vui lòng định dạng dưới dạng owner/repo hoặc nhập URL đầy đủ.'));
      return;
    }

    console.log(pc.blue(`⏳ Đang phân tích cấu trúc từ GitHub Repository: ${repoInfo.owner}/${repoInfo.repo}...`));

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

      console.log(pc.blue(`⏳ Đang lấy thông tin mô tả chi tiết (Description) của các file...`));

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

      console.log(pc.green(`✔ Phân tích xong!\n`));

    } catch (err) {
      console.error(pc.red('❌ Lỗi khi fetch dữ liệu từ GitHub:'), err.response?.data?.message || err.message);
      if (err.response?.status === 404) {
        console.error(pc.yellow('Repository không tồn tại hoặc ở dạng Private. Vui lòng kiểm tra lại đường dẫn.'));
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
      console.log(pc.green('✔ Tất cả cấu hình mẫu (Rules/Workflows/Skills) đều đã được cài đặt đầy đủ trong dự án này.'));
    } else {
      console.log(pc.red(isGithub
        ? 'Không tìm thấy cấu trúc mẫu (Rules/Workflows/Skills) hợp lệ trong GitHub Repository này.'
        : 'Không tìm thấy mẫu nào trong thư mục templates cục bộ. Bạn cần copy folder .agent và .agents vào thư mục templates của my-agent-cli.'));
    }
    return;
  }

  const answers = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selectedPaths',
      message: 'Hãy tích chọn (Space) những nội dung bạn muốn cài đặt, ấn Enter để xác nhận:',
      choices: choices,
      pageSize: 15
    }
  ]);

  const selectedPaths = answers.selectedPaths || [];

  if (selectedPaths.length === 0) {
    console.log(pc.yellow('⚠️ Bạn chưa chọn file nào. Hủy thao tác.'));
    return;
  }

  console.log(pc.blue('\n⏳ Đang cài đặt...'));

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
          console.error(pc.red(`  ✖ Lỗi khi download file: ${filePath}`));
        }
      }
      console.log(pc.green(`  ✔ Đã lấy về: `) + relPath);
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
        console.log(pc.green(`  ✔ Đã copy: `) + relPath);
      }
    }
  }

  console.log(pc.green(pc.bold('\n🎉 Xong! Mã của bạn đã sẵn sàng cho AI Assistant.')));
}

run().catch(err => {
  if (err.isTtyError || err.name === 'ExitPromptError') return;
  console.error(pc.red('Đã có lỗi xảy ra:'), err);
});
