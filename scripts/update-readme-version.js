// scripts/update-readme-version.js
// Updates the version and release notes link in README.md from the VERSION file

var fs = require('fs');
var path = require('path');

try {
	var versionPath = path.join(__dirname, '../VERSION');
	var readmePath = path.join(__dirname, '../README.md');
	var releaseNotesDir = 'RELEASE_NOTES';

	var version = fs.readFileSync(versionPath, 'utf8').trim();
	var releaseNotesFile = releaseNotesDir + '/' + version + '.md';

	var readme = fs.readFileSync(readmePath, 'utf8');
	// Regex for the release line (multiline safe, no /s flag)
	var releaseLineRegex = /\*\*Latest release:\*\*([\s\S]*?)— see \[.*?\]\(RELEASE_NOTES\/?[\w\.-]*\) and \[.*?\]\(CHANGELOG.md\) for details\./;
	var newReleaseLine = '**Latest release:** `' + version + '` — see [' + releaseNotesFile + '](' + releaseNotesFile + ') and [CHANGELOG.md](CHANGELOG.md) for details.';
	var updated = readme.replace(releaseLineRegex, newReleaseLine);
	fs.writeFileSync(readmePath, updated);
	console.log('README.md updated to version ' + version);
} catch (e) {
	console.error('Error updating README.md:', e);
	process.exit(1);
}
