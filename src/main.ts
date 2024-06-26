
import * as core from '@actions/core';
import * as github from '@actions/github';
import * as glob from '@actions/glob';
import GhProjectsApi from "github-project";

import { titleCase, objValueMap, addDaysToDate, getRepoIssuesByTitle,  parseTemplateFile as parseTemplate, Template, TemplateDefaults } from './util.js';

export const run = async () => {

    const templatePath = core.getInput('template-path');
    const followSymbolicLinks = core.getBooleanInput('follow-symbolic-links');
    const githubToken = core.getInput('github-token') || process.env.GITHUB_TOKEN || '';
    const projectGithubToken = core.getInput('project-github-token') || githubToken;

    const templateDefaults: TemplateDefaults = {
        repoOwner: core.getInput('repo-owner') || github.context.repo.owner,
        repoName: core.getInput('repo-name') || github.context.repo.repo,
        group: parseInt(core.getInput('group') || '0'),
        labels: core.getInput('labels') ? core.getInput('labels').split(',').map(label => label.trim()) : [],
        assignees: core.getInput('assignees') ? core.getInput('assignees').split(',').map(assignee => assignee.trim()) : [],
        milestone: core.getInput('milestone') ? parseInt(core.getInput('milestone')) : undefined,
        projectOwner: core.getInput('project-owner') || github.context.repo.owner,
        projectNumber: core.getInput('project-number'),
        projectFields: JSON.parse(core.getInput('project-fields') || '{}')
    };
    
    const octokit = github.getOctokit(githubToken);

    const dateExpRegex = /^@today([\+\-]\d+)?$/i

    const output: Record<string, { 
        'issue-repo-owner': string;
        'issue-repo-name': string;
        'issue-repo': string;
        'issue-url': string;
        'issue-number': number;
        'issue-node-id': string;
        'project-item-node-id'?: string;
        'project-owner'?: string;
        'project-number'?: number 
    }> = {};


    const globber = await glob.create(templatePath, { followSymbolicLinks });
    const templateFiles = await globber.glob();

    const templatesByRepo = new Map<string, Template[]>();

    await Promise.all(
        templateFiles.map(async (templateFile) => {
            const template = await parseTemplate(templateFile, templateDefaults);
            const repo = `${template.repoOwner}/${template.repoName}`;
            const templates = templatesByRepo.get(repo);
            if (templates) {
                templates.push(template);
            }
            else {
                templatesByRepo.set(repo, [template]);
            }
        })
    );

    for (const [repo, templates] of templatesByRepo) {
        const [repoOwner, repoName] = repo.split('/');
        const existingIssuesByTitle = await getRepoIssuesByTitle({ octokit, owner: repoOwner, repo: repoName, state: 'all' });
        
        const sortedTemplates = templates.sort((t1, t2) => t1.group - t2.group);
        
        const lowestMissingOrOpenGroup = sortedTemplates.find(template => existingIssuesByTitle.get(template.title)?.state !== 'closed')?.group ?? 0;
        const highestExistingGroup = sortedTemplates.reverse().find(template => existingIssuesByTitle.has(template.title))?.group ?? 0;
        const groupMin = Math.max(lowestMissingOrOpenGroup, highestExistingGroup);

        const templatesToProcess = sortedTemplates.filter(template => template.group <= groupMin && !existingIssuesByTitle.has(template.title));

        // might need to break this up into batches to avoid rate-limiting
        await Promise.all(
            templatesToProcess.map(async (template) => {
                
                const { repoOwner, repoName, projectNumber, projectOwner, projectFields, templateName, ...issueData } = template;

                const { data: issue } = await octokit.rest.issues.create({
                    owner: repoOwner,
                    repo: repoName,
                    ...issueData
                });

                output[templateName] = {
                    'issue-repo': repo,
                    'issue-repo-owner': repoOwner,
                    'issue-repo-name': repoName,
                    'issue-url': issue.url,
                    'issue-number': issue.number,
                    'issue-node-id': issue.node_id
                };

                if (projectNumber && projectOwner) {
                    const ghProjectsApi = new GhProjectsApi({
                        owner: projectOwner,
                        number: parseInt(projectNumber),
                        token: projectGithubToken,
                        fields: objValueMap(projectFields ?? {}, (_, key) => titleCase(key)),
                    });
        
                    const processedProjectFields = objValueMap(projectFields ?? {}, (val) => {
                        const trimmedVal = String(val).trim();
                        const dateExpMatches = dateExpRegex.exec(trimmedVal);
                        if (dateExpMatches) {
                            const dayAdjustment = parseInt(dateExpMatches[1] ?? 0) ;
                            return addDaysToDate(new Date(), dayAdjustment).toISOString();
                        }
                        return trimmedVal;
                    })
        
                    const projectItem = await ghProjectsApi.items.add(issue.node_id, processedProjectFields);
                    
                    Object.assign(output[templateName], { 
                        'project-item-node-id': projectItem.id,
                        'project-owner': projectOwner,
                        'project-number': projectNumber 
                    });
                }
            })
        );
    }    

    core.setOutput('issues', output);
}