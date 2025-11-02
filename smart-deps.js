#!/usr/bin/env node

/**
 * Smart dependency management for dual-mode development
 * Supports both published packages and local development
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CONFIG_FILE = 'package.json';

function loadConfig() {
  const configPath = path.join(process.cwd(), CONFIG_FILE);
  if (!fs.existsSync(configPath)) {
    throw new Error(`${CONFIG_FILE} not found`);
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function isLocalDevelopment() {
  // Check if we're in a Git submodule context
  const gitModulesPath = path.join('..', '..', '.gitmodules');
  return fs.existsSync(gitModulesPath);
}

function updateDependencies(config) {
  const { unifiedDependencies } = config;
  if (!unifiedDependencies) {
    console.log('No unified dependencies configuration found');
    return;
  }

  const { localDevelopment, strategy } = unifiedDependencies;
  
  if (localDevelopment && isLocalDevelopment()) {
    console.log('Local development mode detected');
    // Link to local packages in meta repository
    execSync('npm link', { stdio: 'inherit' });
  } else {
    console.log('Published package mode');
    // Use published versions from GitHub Packages
    execSync('npm install', { stdio: 'inherit' });
  }
}

function main() {
  try {
    const config = loadConfig();
    updateDependencies(config);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { loadConfig, isLocalDevelopment, updateDependencies };