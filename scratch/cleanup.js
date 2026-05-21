const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');

function walk(dir, callback) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filepath = path.join(dir, file);
        const stat = fs.statSync(filepath);
        if (stat.isDirectory()) {
            walk(filepath, callback);
        } else if (file.endsWith('.js')) {
            callback(filepath);
        }
    }
}

function removeConsoleLogs(content) {
    // Basic regex to remove console.(log|error|warn)(...)
    // This handles single-line statements safely.
    return content.replace(/^[ \t]*console\.(log|error|warn)\([^;]*\);?[ \t]*\r?\n/gm, '');
}

function processFile(filepath) {
    let content = fs.readFileSync(filepath, 'utf8');
    const original = content;

    // Remove console.logs
    content = removeConsoleLogs(content);

    // If it's a controller in institutionRep, standardise catch blocks
    if (filepath.includes(path.join('controllers', 'institutionRep'))) {
        // Add next to parameters if missing
        content = content.replace(/async\s+(\w+)\s*\(\s*req\s*,\s*res\s*\)\s*\{/g, 'async $1(req, res, next) {');
        content = content.replace(/const\s+(\w+)\s*=\s*async\s*\(\s*req\s*,\s*res\s*\)\s*=>\s*\{/g, 'const $1 = async (req, res, next) => {');
        
        // Standardise catch block
        content = content.replace(/catch\s*\(\s*error\s*\)\s*\{([\s\S]*?)\}/g, (match, catchBody) => {
            // Keep if already next(error);
            if (catchBody.trim() === 'next(error);') {
                return 'catch (error) {\n            next(error);\n        }';
            }
            // Check if it's downloadReport that has `if (!res.headersSent)`
            if (catchBody.includes('!res.headersSent') && !filepath.includes('export-report')) {
                return 'catch (error) {\n            if (!res.headersSent) {\n                next(error);\n            }\n        }';
            }
            return 'catch (error) {\n            next(error);\n        }';
        });
    }

    if (content !== original) {
        fs.writeFileSync(filepath, content, 'utf8');
        console.log(`Updated ${filepath}`);
    }
}

walk(srcDir, processFile);
console.log('Cleanup completed.');
