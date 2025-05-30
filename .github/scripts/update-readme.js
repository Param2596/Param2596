import { Octokit } from '@octokit/rest';
import { readFileSync, writeFileSync } from 'fs';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

async function getRecentActivity() {
  const username = process.env.GITHUB_USERNAME;
  
  try {
    const { data: repos } = await octokit.repos.listForUser({
      username,
      sort: 'updated',
      per_page: 100,
    });

    const recentCommits = [];
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    for (const repo of repos.slice(0, 15)) {
      try {
        const { data: commits } = await octokit.repos.listCommits({
          owner: username,
          repo: repo.name,
          author: username,
          since: oneWeekAgo.toISOString(),
          per_page: 10,
        });

        commits.forEach(commit => {
          recentCommits.push({
            repo: repo.name,
            message: commit.commit.message.split('\n')[0].substring(0, 60),
            date: new Date(commit.commit.author.date),
            url: commit.html_url,
          });
        });
      } catch (error) {
        console.log(`Skipping ${repo.name}: ${error.message}`);
      }
    }

    return recentCommits
      .sort((a, b) => b.date - a.date)
      .slice(0, 8);

  } catch (error) {
    console.error('Error fetching activity:', error);
    return [];
  }
}

async function getContributionStats() {
  const username = process.env.GITHUB_USERNAME;
  
  try {
    const { data: repos } = await octokit.repos.listForUser({
      username,
      per_page: 100,
    });

    const totalRepos = repos.length;
    const publicRepos = repos.filter(repo => !repo.private).length;
    const privateRepos = totalRepos - publicRepos;
    
    let totalCommits = 0;
    let commitsThisWeek = 0;
    const oneYearAgo = new Date();
    const oneWeekAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    for (const repo of repos.slice(0, 25)) {
      try {
        const { data: allCommits } = await octokit.repos.listCommits({
          owner: username,
          repo: repo.name,
          author: username,
          since: oneYearAgo.toISOString(),
          per_page: 100,
        });
        totalCommits += allCommits.length;

        const { data: weekCommits } = await octokit.repos.listCommits({
          owner: username,
          repo: repo.name,
          author: username,
          since: oneWeekAgo.toISOString(),
          per_page: 100,
        });
        commitsThisWeek += weekCommits.length;
      } catch (error) {
        console.log(`Skipping commit count for ${repo.name}: ${error.message}`);
      }
    }
    
    return {
      totalRepos,
      publicRepos,
      privateRepos,
      totalCommits,
      commitsThisWeek,
    };
  } catch (error) {
    console.error('Error fetching stats:', error);
    return null;
  }
}

function generateActivitySection(commits, stats) {
  const currentDate = new Date().toLocaleDateString('en-US', { 
    weekday: 'long',
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const activityLines = commits.map((commit, index) => {
    const date = commit.date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    const emoji = ['🚀', '⚡', '🔥', '💎', '✨', '🎯', '🌟', '💫'][index] || '🚀';
    return `${emoji} **[${commit.repo}](https://github.com/Param2596/${commit.repo})** • ${commit.message} • *${date}*`;
  });

  const statsDisplay = stats ? `
<div align="center">

## 📊 **LIVE DEVELOPMENT STATS**
*Last Updated: ${currentDate}*

### 🔢 **CODE METRICS**

\`\`\`ascii
╔══════════════════════════════════════════════════════════════╗
║                    📈 REPOSITORY OVERVIEW                    ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║   📊 Total Repositories: ${String(stats.totalRepos).padStart(3)}                          ║
║   🌍 Public Projects:    ${String(stats.publicRepos).padStart(3)}                          ║
║   🔒 Private Projects:   ${String(stats.privateRepos).padStart(3)}                          ║
║                                                              ║
╠══════════════════════════════════════════════════════════════╣
║                    💻 COMMIT ACTIVITY                        ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║   🔥 Total Commits:      ${String(stats.totalCommits).padStart(4)}+                        ║
║   ⚡ This Week:          ${String(stats.commitsThisWeek).padStart(3)}                           ║
║   📅 Daily Average:      ${String(Math.round(stats.totalCommits / 365)).padStart(3)}                           ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
\`\`\`

</div>

### ⚡ **RECENT COMMIT ACTIVITY**
` : '';

  return `## 🔥 **RECENT ACTIVITY**

${statsDisplay}

${activityLines.length > 0 ? activityLines.map(line => `- ${line}`).join('\n') : '- 🛠️ Building awesome projects...'}

<div align="center">

*🤖 Auto-updated by GitHub Actions • Next update in 24 hours*

</div>

---`;
}

async function updateReadme() {
  try {
    const readmePath = 'README.md';
    const readmeContent = readFileSync(readmePath, 'utf8');
    
    console.log('🔍 Fetching latest GitHub activity...');
    const [commits, stats] = await Promise.all([
      getRecentActivity(),
      getContributionStats()
    ]);
    
    console.log(`📊 Found ${commits.length} recent commits`);
    console.log(`📈 Stats: ${stats?.totalRepos} repos, ${stats?.totalCommits}+ commits`);
    
    const newActivitySection = generateActivitySection(commits, stats);
    
    // Replace the entire ## 🔥 **RECENT ACTIVITY** section
    let updatedContent = readmeContent.replace(
      /## 🔥 \*\*RECENT ACTIVITY\*\*[\s\S]*?(?=---## 🛠️)/g,
      newActivitySection
    );
    
    writeFileSync(readmePath, updatedContent);
    console.log('✅ README.md updated successfully with beautiful new UI!');
    
  } catch (error) {
    console.error('❌ Error updating README:', error);
    process.exit(1);
  }
}

updateReadme();
