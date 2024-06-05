import * as core from '@actions/core'


const templatePath: string = core.getInput('templatePath')


core.info(`Template path ${templatePath}`);