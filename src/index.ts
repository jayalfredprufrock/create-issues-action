import * as core from '@actions/core';
import * as github from '@actions/github';
import * as glob from '@actions/glob';
import yaml from "js-yaml";
import fs from 'fs/promises';
import path from 'path';
import { titleCase } from './util.js';


const templatePath = core.getInput('template-path');
const followSymbolicLinks = core.getBooleanInput('follow-symbolic-links');
const githubToken = core.getInput('github-token') ?? process.env.GITHUB_TOKEN ?? '';

const globber = await glob.create(templatePath, { followSymbolicLinks });
const templateFiles = await globber.glob();

const frontmatterRegex = /^\s*-{3,}\s*$/m;

export const processTemplateFile = async (templateFile: string): Promise<void> => {
    const templateData = await fs.readFile(templateFile, { encoding: 'utf-8'});

    const [maybeBody, yamlData, body = maybeBody] = templateData.split(frontmatterRegex, 3);

    const issueData = (yamlData ? yaml.load(yamlData) : {}) as Record<string, any>;
    
    const octokit = github.getOctokit(githubToken);

    const issue = await octokit.rest.issues.create({
        ...github.context.repo,
        title: issueData.title ?? titleCase(path.basename(templateFile)),
        labels: issueData.labels,
        assignees: issueData.assignees,
        body
    });
}

await Promise.all(templateFiles.map(templateFile => processTemplateFile(templateFile)));