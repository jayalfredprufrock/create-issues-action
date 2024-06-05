import * as core from '@actions/core';
import * as glob from '@actions/glob';


const templatePath = core.getInput('template-path');
const followSymbolicLinks = core.getBooleanInput('follow-symbolic-links');

const globber = await glob.create(templatePath, { followSymbolicLinks });
const templates = await globber.glob();

core.info(`Templates ${templates.join(',')}`);