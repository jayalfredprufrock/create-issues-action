import * as github from '@actions/github';
import yaml from "js-yaml";
import fs from 'fs/promises';
import path from 'path';

export const titleCase = (str: string): string => {
    return str
        .trim()
        .replace(/([a-z])([A-Z]+)/g, '$1 $2')
        .split(/[-_\s]+/)
        .filter((s) => s.trim())
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
        .join(' ');
}

export const objValueMap = <V, T>(obj: Record<string, V>, transformer: (value: V, key: string) => T): Record<string, T> => {
    return Object.entries(obj).reduce((o, [key, value]) => {
        o[key] = transformer(value, key);
        return o;
    }, {} as Record<string, T>);
};

export const addDaysToDate = (date: Date, days: number) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

export type Issue = {
    repoOwner: string;
    repoName: string;
    title: string;
    state: string;
    body: string;
    labels: string[];
    assignees: string[];
    milestone?: number;

    // below fields not actually part of GitHub issue data
    // but part of the template
    group?: number;
    projectNumber?: string;
    projectOwner?: string;
    projectFields?: Record<string,  string | number | boolean>;
}


export const getRepoIssuesByTitle = async (options: { octokit: ReturnType<typeof github.getOctokit>, owner: string, repo: string, state: 'open' | 'closed' | 'all' }): Promise<Map<string, Issue>> => {
    const { octokit, ...getOptions } = options;
    const issuesByTitle = new Map<string, Issue>();
    const issuePaginator = octokit.paginate.iterator(octokit.rest.issues.listForRepo, { ...getOptions, per_page: 100 });
    for await (const response of issuePaginator) {
        response.data.forEach(issue => {
            issuesByTitle.set(issue.title, { 
                repoOwner: issue.repository?.owner.name ?? '', 
                repoName: issue.repository?.name ?? '',
                title: issue.title, 
                state: issue.state, 
                labels: issue.labels.map(label => typeof label === 'string' ? label : label.name ?? ''),
                assignees: issue.assignees?.map(assignnee => assignnee.name ?? '') ?? [],
                milestone: issue.milestone?.number,
                body: issue.body ?? ''
            });
        });
    }
    return issuesByTitle;
}

const frontmatterRegex = /^\s*-{3,}\s*$/m;

export type TemplateDefaults = Omit<Issue, 'body' | 'state' | 'title'>;

export const parseTemplateFile = async (templateFile: string, defaults: TemplateDefaults) => {
    const templateData = await fs.readFile(templateFile, { encoding: 'utf-8'});
    const templateName = path.parse(templateFile).name;

    const [maybeBody, yamlData, body = maybeBody] = templateData.split(frontmatterRegex, 3);

    const issueFrontmatter = (yamlData ? yaml.load(yamlData) : {}) as Partial<Omit<Issue, 'state'>>;

    return {
        ...defaults,
        templateName,
        title: titleCase(templateName),
        group: 0,
        ...issueFrontmatter,
        labels: [...defaults.labels, ...(issueFrontmatter.labels ?? [])],
        assignees: [...defaults.assignees, ...(issueFrontmatter.assignees ?? [])],
        projectFields: { ...defaults.projectFields, ...issueFrontmatter.projectFields },
        body
    }
};

export type Template = Awaited<ReturnType<typeof parseTemplateFile>>;

