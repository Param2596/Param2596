import { Octokit } from '@octokit/rest';
import { readFileSync, writeFileSync } from 'fs';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

async function getRecentActivity() {
  const username = process.env.GITHUB_USERNAME;
  
  try {
    // Get user's repositories
    const { data: repos } = await octokit.repos.listForUser({
      username,
      sort: 'updated',
      per_page: 100,
    });

    // Get recent commits across all repos
    const recentCommits = [];
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    for (const repo of repos.slice(0, 10)) {
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
            message: commit.commit.message.split('\n')[0].substring(0, 50),
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
      .slice(0, 5);

  } catch (error) {
    console.error('Error fetching activity:', error);
    return [];
  }
}

async function getContributionStats() {
  const username = process.env.GITHUB_USERNAME;
  
  try {
    const { data: user } = await octokit.users.getByUsername({ username });
    const { data: repos } = await octokit.repos.listForUser({
      username,
      per_page: 100,
    });

    const totalRepos = repos.length;
    const publicRepos = repos.filter(repo => !repo.private).length;
    const totalStars = repos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
    
    return {
      totalRepos,
      publicRepos,
      totalStars,
      followers: user.followers,
    };
  } catch (error) {
    console.error('Error fetching stats:', error);
    return null;
  }
}

function generateActivitySection(commits, stats) {
  const activityLines = commits.map(commit => {
    const date = commit.date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
    return `- 🚀 **[${commit.repo}](https://github.com/Param2596/${commit.repo})** • ${commit.message} • *${date}*`;
  });

  const statsSection = stats ? `
### 📈 **LIVE STATS**
\`\`\`ascii
┌─────────────────────────────────────────┐
│  📊 ${stats.totalRepos} Total Repos   ⭐ ${stats.totalStars} Stars    │
│  👥 ${stats.followers} Followers    📂 ${stats.publicRepos} Public     │
└─────────────────────────────────────────┘
\`\`\`
` : '';

  return `## 🔥 **RECENT ACTIVITY**

### ⚡ **LATEST COMMITS**
${activityLines.length > 0 ? activityLines.join('\n') : '- 🛠️ Building awesome projects...'}

${statsSection}

---`;
}

async function updateReadme() {
  try {
    const readmePath = 'PROFILE_README.md';
    const readmeContent = readFileSync(readmePath, 'utf8');
    
    const [commits, stats] = await Promise.all([
      getRecentActivity(),
      getContributionStats()
    ]);
    
    const newActivitySection = generateActivitySection(commits, stats);
    
    // Replace all GitHub stats sections with our new activity section
    const updatedContent = readmeContent.replace(
      /## 📊 \*\*GITHUB STATS\*\*[\s\S]*?(?=## 🛠️)/g,
      newActivitySection
    );
    
    writeFileSync(readmePath, updatedContent);
    console.log('✅ README updated successfully!');
    
  } catch (error) {
    console.error('❌ Error updating README:', error);
    process.exit(1);
  }
}

updateReadme();
