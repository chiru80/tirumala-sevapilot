/**
 * Tirumala SevaPilot — Production Release Packager & Security Linter (Phase 16)
 * Validates Manifest V3 compliance, permission minimality, security boundaries,
 * and builds a clean production distribution package for Chrome Web Store.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');

console.log('🚀 [SevaPilot Packager] Starting Production Package Validation...');

// 1. Verify dist exists
if (!fs.existsSync(distDir)) {
  console.error('❌ [Error] dist directory does not exist. Run "npm run build" first.');
  process.exit(1);
}

// 2. Read and validate dist/manifest.json
const manifestPath = path.join(distDir, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  console.error('❌ [Error] dist/manifest.json is missing.');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// A. Manifest Version Check
if (manifest.manifest_version !== 3) {
  console.error(`❌ [Error] Expected Manifest V3, found: ${manifest.manifest_version}`);
  process.exit(1);
}

// B. Permission Minimality Check (Phase 17 audited set)
const allowedPermissions = new Set([
  'storage',
  'sidePanel',
  'scripting',
  'contextMenus',
]);

// Permissions removed during the Phase 17 manifest audit, plus the classic
// high-risk set. Re-adding any of these fails the release package.
const forbiddenPermissions = [
  'tabs',            // removed: grants read access to browsing history
  'activeTab',       // removed: redundant — host access is already pinned
  'clipboardRead',
  'clipboardWrite',
  'history',
  'bookmarks',
  'cookies',
  '<all_urls>',
  'webNavigation',
  'debugger',
  'proxy',
  'webRequest',
  'webRequestBlocking',
];

for (const p of manifest.permissions || []) {
  if (forbiddenPermissions.includes(p)) {
    console.error(`❌ [Security Alert] Forbidden high-risk permission declared: ${p}`);
    process.exit(1);
  }
  if (!allowedPermissions.has(p)) {
    console.error(`❌ [Security Alert] Permission outside the audited minimal set: ${p}`);
    process.exit(1);
  }
}

// C. Host Permission Pinning
const officialHosts = [
  'https://ttdevasthanams.ap.gov.in/*',
  'https://tirupatibalaji.ap.gov.in/*',
];

for (const host of manifest.host_permissions || []) {
  if (!officialHosts.includes(host)) {
    console.error(`❌ [Security Alert] Host permission not pinned to official TTD origin: ${host}`);
    process.exit(1);
  }
}

// D. CSP Check
const csp = manifest.content_security_policy?.extension_pages;
if (!csp || !csp.includes("script-src 'self'") || !csp.includes("object-src 'self'")) {
  console.error('❌ [Security Alert] Weak or missing extension Content Security Policy.');
  process.exit(1);
}

// 3. Scan dist for unauthorized source maps or test fixtures
function scanDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      scanDir(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const allDistFiles = scanDir(distDir);
const forbiddenExtensions = ['.map', '.ts', '.tsx', '.test.js', '.spec.js'];

for (const filePath of allDistFiles) {
  const ext = path.extname(filePath);
  if (forbiddenExtensions.includes(ext)) {
    console.warn(`⚠️ [Artifact Leak] Found unneeded file in dist: ${path.relative(distDir, filePath)}`);
  }
}

// 4. Create zip archive
const version = manifest.version || '1.1.0';
const releaseDir = path.resolve(rootDir, 'releases');
if (!fs.existsSync(releaseDir)) {
  fs.mkdirSync(releaseDir, { recursive: true });
}

const zipName = `tirumala-sevapilot-v${version}.zip`;
const zipPath = path.join(releaseDir, zipName);

if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

console.log(`📦 Packaging production bundle into ${zipName}...`);

try {
  if (process.platform === 'win32') {
    // Windows PowerShell Compress-Archive
    execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${distDir}\\*' -DestinationPath '${zipPath}' -Force"`, {
      stdio: 'inherit',
    });
  } else {
    // Unix zip utility
    execSync(`cd "${distDir}" && zip -r "${zipPath}" . -x "*.zip"`, {
      stdio: 'inherit',
    });
  }

  const stat = fs.statSync(zipPath);
  const sizeMb = (stat.size / (1024 * 1024)).toFixed(2);
  const sizeKb = (stat.size / 1024).toFixed(1);

  console.log('✅ [Success] Production package created successfully!');
  console.log(`   File: ${zipPath}`);
  console.log(`   Size: ${sizeKb} KB (${sizeMb} MB)`);
  console.log(`   Manifest Version: V${manifest.manifest_version}`);
  console.log(`   Permissions: ${manifest.permissions.join(', ')}`);
  console.log(`   Host Origins: ${manifest.host_permissions.join(', ')}`);
} catch (err) {
  console.error('❌ [Error] Failed to create zip package:', err);
  process.exit(1);
}
