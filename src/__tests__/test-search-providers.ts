#!/usr/bin/env bun
/**
 * Test script to validate PyPI, npm, and GitHub search providers
 */

import { PyPISearchProvider } from '../integrations/search-providers/pypi';
import { NPMSearchProvider } from '../integrations/search-providers/npm';
import { createSearchProvider } from '../integrations/factory';
import { elizaLogger } from '@elizaos/core';

// Mock runtime for GitHub search
const mockRuntime = {
  getSetting: (key: string) => {
    const settings: Record<string, string | undefined> = {
      'GITHUB_TOKEN': process.env.GITHUB_TOKEN,
    };
    return settings[key] || null;
  },
  getService: (name: string) => {
    if (name === 'github') {
      // Return a mock GitHub service with search methods
      return {
        searchRepositories: async (query: string, options: any) => {
          console.log(`🔍 GitHub repo search: ${query}`);
          return {
            items: [
              {
                full_name: 'microsoft/TypeScript',
                html_url: 'https://github.com/microsoft/TypeScript',
                description: 'TypeScript is a superset of JavaScript that compiles to clean JavaScript output.',
                stargazers_count: 89000,
                language: 'TypeScript',
                forks_count: 12000,
                open_issues_count: 5000,
                updated_at: '2024-01-01T00:00:00Z',
                owner: { login: 'microsoft' }
              }
            ]
          };
        },
        searchIssues: async (query: string, options: any) => {
          console.log(`🔍 GitHub issue search: ${query}`);
          return {
            items: [
              {
                title: 'TypeScript compilation issue',
                html_url: 'https://github.com/microsoft/TypeScript/issues/12345',
                body: 'Having trouble with TypeScript compilation...',
                state: 'open',
                comments: 5,
                user: { login: 'developer123' },
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
                number: 12345
              }
            ]
          };
        }
      };
    }
    return null;
  }
} as any;

async function testPyPISearch() {
  console.log('\n🐍 Testing PyPI Search Provider...');
  const provider = new PyPISearchProvider();
  
  try {
    const results = await provider.search('machine learning', 5);
    console.log(`✅ Found ${results.length} PyPI packages`);
    
    if (results.length > 0) {
      const first = results[0];
      console.log(`📦 Example: ${first.title}`);
      console.log(`🔗 URL: ${first.url}`);
      console.log(`📄 Snippet: ${first.snippet.substring(0, 100)}...`);
      console.log(`⭐ Score: ${first.score}`);
      console.log(`🏷️  Provider: ${first.provider}`);
    }
  } catch (error) {
    console.error('❌ PyPI search failed:', error instanceof Error ? error.message : String(error));
  }
}

async function testNPMSearch() {
  console.log('\n📦 Testing NPM Search Provider...');
  const provider = new NPMSearchProvider();
  
  try {
    const results = await provider.search('typescript', 5);
    console.log(`✅ Found ${results.length} NPM packages`);
    
    if (results.length > 0) {
      const first = results[0];
      console.log(`📦 Example: ${first.title}`);
      console.log(`🔗 URL: ${first.url}`);
      console.log(`📄 Snippet: ${first.snippet.substring(0, 100)}...`);
      console.log(`⭐ Score: ${first.score}`);
      console.log(`🏷️  Provider: ${first.provider}`);
      // Removed scores check as it's not part of standard SearchMetadata
    }
  } catch (error) {
    console.error('❌ NPM search failed:', error instanceof Error ? error.message : String(error));
  }
}

async function testGitHubSearch() {
  console.log('\n🐙 Testing GitHub Search Provider...');
  
  try {
    const provider = createSearchProvider('github', mockRuntime);
    const results = await provider.search('typescript compiler', 5);
    console.log(`✅ Found ${results.length} GitHub results`);
    
    if (results.length > 0) {
      const first = results[0];
      console.log(`📦 Example: ${first.title}`);
      console.log(`🔗 URL: ${first.url}`);
      console.log(`📄 Snippet: ${first.snippet.substring(0, 100)}...`);
      console.log(`⭐ Score: ${first.score}`);
      console.log(`🏷️  Provider: ${first.provider}`);
      if (first.metadata.type) {
        console.log(`📂 Type: ${first.metadata.type}`);
      }
    }
  } catch (error) {
    console.error('❌ GitHub search failed:', error instanceof Error ? error.message : String(error));
  }
}

async function testPackageSpecificSearches() {
  console.log('\n🔎 Testing Package-Specific Searches...');
  
  // Test PyPI specific package
  try {
    const pypiProvider = new PyPISearchProvider();
    const tensorflowResult = await pypiProvider.getPackage('tensorflow');
    if (tensorflowResult) {
      console.log(`✅ PyPI specific package: ${tensorflowResult.title}`);
    }
  } catch (error) {
    console.log(`⚠️  PyPI specific package test failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  // Test NPM specific package
  try {
    const npmProvider = new NPMSearchProvider();
    const reactResult = await npmProvider.getPackage('react');
    if (reactResult) {
      console.log(`✅ NPM specific package: ${reactResult.title}`);
    }
  } catch (error) {
    console.log(`⚠️  NPM specific package test failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function main() {
  console.log('🧪 Testing ElizaOS Research Plugin - Search Provider Integration\n');
  
  await testPyPISearch();
  await testNPMSearch();
  await testGitHubSearch();
  await testPackageSpecificSearches();
  
  console.log('\n✅ Search provider tests completed!');
  console.log('\n💡 These providers are now integrated into the research service');
  console.log('   and will be automatically selected based on research domain and query keywords.');
}

main().catch(console.error);