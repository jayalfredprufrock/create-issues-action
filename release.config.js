const config = {
    branches: ['main'],
    plugins: [
      '@semantic-release/commit-analyzer',
      '@semantic-release/release-notes-generator',
      '@semantic-release/npm',
      ["@semantic-release/git", {
        "assets": ["package.json", "dist/index.js"],
        "message": "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}"
      }],
      '@semantic-release/github',
      'semantic-release-major-tag'
    ]
};

module.exports = config;
