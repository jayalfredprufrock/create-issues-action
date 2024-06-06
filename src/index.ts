import * as core from '@actions/core';
import * as glob from '@actions/glob';
import yaml from "js-yaml";
import fs from 'fs/promises';


const templatePath = core.getInput('template-path');
const followSymbolicLinks = core.getBooleanInput('follow-symbolic-links');

const globber = await glob.create(templatePath, { followSymbolicLinks });
const templateFiles = await globber.glob();

core.info(`Templates ${templateFiles.join(',')}`);

const frontmatterRegex = /^\s*-{3,}\s*$/m;

export const processTemplateFile = async (templateFile: string): Promise<void> => {
    const templateData = await fs.readFile(templateFile, { encoding: 'utf-8'});

    const [maybeBody, yamlData, body = maybeBody] = templateData.split(frontmatterRegex, 3);

    const templateOverrides = yamlData ? yaml.load(yamlData) : {};
    
    console.log('overrides', templateOverrides);
    console.log('body', body);
}

await Promise.all(templateFiles.map(templateFile => processTemplateFile(templateFile)));