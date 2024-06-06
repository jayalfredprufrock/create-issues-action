import * as core from '@actions/core';
import * as github from '@actions/github';
import * as glob from '@actions/glob';
import GhProjectsApi from "github-project";
import yaml from "js-yaml";
import fs from 'fs/promises';
import path from 'path';
import { titleCase, objValueMap } from './util.js';


const templatePath = core.getInput('template-path');
const followSymbolicLinks = core.getBooleanInput('follow-symbolic-links');
const githubToken = core.getInput('github-token') ?? process.env.GITHUB_TOKEN ?? '';
const projectNumberDefault = core.getInput('project-number');

const globber = await glob.create(templatePath, { followSymbolicLinks });
const templateFiles = await globber.glob();

const octokit = github.getOctokit(githubToken);

const frontmatterRegex = /^\s*-{3,}\s*$/m;

export const processTemplateFile = async (templateFile: string): Promise<void> => {
    const templateData = await fs.readFile(templateFile, { encoding: 'utf-8'});

    const [maybeBody, yamlData, body = maybeBody] = templateData.split(frontmatterRegex, 3);

    const issueData = (yamlData ? yaml.load(yamlData) : {}) as Record<string, any>;
    
    const { data: issue } = await octokit.rest.issues.create({
        ...github.context.repo,
        title: issueData.title ?? titleCase(path.parse(templateFile).name),
        labels: issueData.labels,
        assignees: issueData.assignees,
        milestone: issueData.milestone,
        body
    });
    
    const projectNumber = projectNumberDefault ?? issueData.projectNumber;

    if (projectNumber) {
        const ghProjectsApi = new GhProjectsApi({
            octokit: octokit as any,
            owner: github.context.repo.owner,
            number: parseInt(projectNumber),
            token: githubToken,
            fields: objValueMap(issueData.projectFields ?? {}, (_, key) => titleCase(key)),
        });

        console.log(issueData.projectFields);

        const projectItem = await ghProjectsApi.items.add(issue.node_id, issueData.projectFields);
    }
}

await Promise.all(templateFiles.map(templateFile => processTemplateFile(templateFile)));