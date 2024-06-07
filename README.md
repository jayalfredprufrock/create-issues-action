<h3 align="center">Create Issues GitHub Action</h3>
<p align="center">A GitHub Action that bootstraps/seeds new issues using template files containing frontmatter.<p>

## Basic Usage
Here's a simple workflow that creates new issues when a repository is first created:

```yaml
name: Seed issues
on: ["create"]
if: github.event.ref == github.event.master_branch
permissions:
    issues: write 
jobs:
  create-issues:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: jayalfredprufrock/create-issues@v1
```

By default, any files matching the glob expression `.github/issues/**/*.md` will automatically create issues.
Markdown files can include frontmatter to specify/override issue configuration.

```markdown
---
title: Design Call
assignees: jayalfredprufrock
labels:
    - design
---

Call client to discuss design direction.
```

## Creating Project Items
It is also possible to associate project items after creating issues. Here is an example:

```yaml
name: Seed issues
on: ["create"]
if: github.event.ref == github.event.master_branch
permissions:
    issues: write 
jobs:
  create-issues:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: jayalfredprufrock/create-issues@v1
        with:
            project-number: 1
            project-github-token: ${{ secrets.GH_TOKEN_PROJECT_WRITE }}
```

> Specifying `project-github-token` is necessary when `GITHUB_TOKEN` is not a PAT token with `project:write` scope, as is the case
> when using workflow `permissions` to setup an ad-hoc `GITHUB_TOKEN`. Alternatively, you can pass a single `github-token` as
> input and it will be used for both issue and project creation, assuming the PAT has the necessary scopes.

Within frontmatter, you can automatically set project item fields:

```markdown
---
title: Design Call
assignees: jayalfredprufrock
labels: ["design"]
projectFields:
    status: Todo
    startDate: @today
    endDate: @today+7
---

Call client to discuss design direction.
```

> The special variable `@today` can be used to create an ISO date string, optionally offset by a number days.
> (i.e. `@today-2`)

## Inputs
<!--(inputs-start)-->

| Name  | Required | Default | Description |
| :---: | :------: | :-----: | ----------- |
| `template-path` |  | .github/issues/**/*.md | Path or glob expression to templates. File names should be unique across directories. |
| `follow-symbolic-links` |  | true | Indicates whether to follow symbolic links when globbing templates. |
| `owner` |  |  | The owner of the repo to create issues in if different than the context repo owner. Can be overridden in frontmatter with 'owner' |
| `repo` |  |  | The the repo name to create issues in if different than the context repo. Can be overridden in frontmatter with 'repo' |
| `github-token` |  | ${{ github.token }} | GitHub token or PAT with permissions to create issues and projects in the specified repos. |
| `project-owner` |  |  | The owner of the project if different than the context repo owner. Can be overridden in frontmatter with 'projectOwner' |
| `project-number` |  |  | The number of the project (found in the url) if the issue should be added to the project. Can be overridden in frontmatter with 'projectNumber' |
| `project-github-token` |  |  | GitHub PAT token to use solely for adding issues to projects. Will use 'github-token' input if not present. |

<!--(inputs-end)-->

## Outputs
<!--(outputs-start)-->

| Name  | Description |
| :---: | ----------- |
| `issues` | Map of template names (excluding file extension) containing issue/project info. Use fromJSON to parse output string. }}) |

<!--(outputs-end)-->
