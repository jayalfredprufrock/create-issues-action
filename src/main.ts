
import * as core from '@actions/core';
import * as github from '@actions/github';
import * as glob from '@actions/glob';
import GhProjectsApi from "github-project";
import yaml from "js-yaml";
import fs from 'fs/promises';
import path from 'path';
import { titleCase, objValueMap, addDaysToDate, getRepoIssueTitles } from './util.js';

export const run = async () => {

    const templatePath = core.getInput('template-path');
    const followSymbolicLinks = core.getBooleanInput('follow-symbolic-links');
    const githubToken = core.getInput('github-token') || process.env.GITHUB_TOKEN || '';

    const owner = core.getInput('owner') || github.context.repo.owner;
    const repo = core.getInput('repo') || github.context.repo.repo;

    const projectGithubToken = core.getInput('project-github-token') || githubToken;
    const projectOwnerDefault = core.getInput('project-owner') || github.context.repo.owner;
    const projectNumberDefault = core.getInput('project-number');

    const globber = await glob.create(templatePath, { followSymbolicLinks });
    const templateFiles = await globber.glob();

    const octokit = github.getOctokit(githubToken);

    const frontmatterRegex = /^\s*-{3,}\s*$/m;
    const dateExpRegex = /^@today([\+\-]\d+)?$/i

    const output: Record<string, { 
        'issue-owner': string;
        'issue-repo': string;
        'issue-url': string;
        'issue-number': number;
        'issue-node-id': string;
        'project-item-node-id'?: string;
        'project-owner'?: string;
        'project-number'?: number 
    }> = {};

    const existingIssueTitlePromisesByRepo = new Map<string, Promise<Set<string>>>(); 

    const processTemplateFile = async (templateFile: string): Promise<void> => {
        const templateData = await fs.readFile(templateFile, { encoding: 'utf-8'});
        const templateName = path.parse(templateFile).name;

        const [maybeBody, yamlData, body = maybeBody] = templateData.split(frontmatterRegex, 3);

        const issueData = (yamlData ? yaml.load(yamlData) : {}) as Record<string, any>;

        const issueOwner = issueData.owner ?? owner;
        const issueRepo = issueData.repo ?? repo;
        const issueTitle = issueData.title ?? titleCase(templateName);

        let existingIssueTitlesPromise = existingIssueTitlePromisesByRepo.get(`${issueOwner}/${issueRepo}`);

        if (!existingIssueTitlesPromise) {
            existingIssueTitlesPromise = getRepoIssueTitles({ octokit, owner: issueOwner, repo: issueRepo, state: 'open' });
            existingIssueTitlePromisesByRepo.set(`${issueOwner}/${issueRepo}`, existingIssueTitlesPromise);
        }

        const existingIssueTitles = await existingIssueTitlesPromise;

        if (existingIssueTitles.has(issueTitle)) {
            return;
        }
        
        const { data: issue } = await octokit.rest.issues.create({
            owner: issueOwner,
            repo: issueRepo,
            title: issueTitle,
            labels: issueData.labels,
            assignees: issueData.assignees,
            milestone: issueData.milestone,
            body
        });

        output[templateName] = {
            'issue-repo': issueRepo,
            'issue-owner': issueOwner,
            'issue-url': issue.url,
            'issue-number': issue.number,
            'issue-node-id': issue.node_id
        };
        
        const projectNumber = issueData.projectNumber ?? projectNumberDefault;
        const projectOwner = issueData.projectOwner ?? projectOwnerDefault;

        if (projectNumber) {
            const ghProjectsApi = new GhProjectsApi({
                owner: projectOwner,
                number: parseInt(projectNumber),
                token: projectGithubToken,
                fields: objValueMap(issueData.projectFields ?? {}, (_, key) => titleCase(key)),
            });

            const projectFields = objValueMap(issueData.projectFields ?? {}, (val) => {
                const trimmedVal = String(val).trim();
                const dateExpMatches = dateExpRegex.exec(trimmedVal);
                if (dateExpMatches) {
                    const dayAdjustment = parseInt(dateExpMatches[1] ?? 0) ;
                    return addDaysToDate(new Date(), dayAdjustment).toISOString();
                }
                return trimmedVal;
            })

            const projectItem = await ghProjectsApi.items.add(issue.node_id, projectFields);
            
            Object.assign(output[templateName], { 
                'project-item-node-id': projectItem.id,
                'project-owner': projectOwner,
                'project-number': projectNumber 
            });
        }
    }

    await Promise.all(templateFiles.map(templateFile => processTemplateFile(templateFile)));

    core.setOutput('issues', output);
}