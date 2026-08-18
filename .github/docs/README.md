# Github actions for cube-clock-configuration

This documentation presents the different Github actions and workflows and how to use them.

GitHub Actions makes it easy to automate software workflows, CI/CD. It provides tools to build, test, and deploy code right from GitHub. 
It can also ease code reviews, branch management, and issue triaging. For more information on GitHub action, read the [GitHub Action documentation.](https://docs.github.com/en/actions/learn-github-actions/understanding-github-actions) 

The .github folder is the standard folder used by github to host local 'action' and 'workflow' components.

For the moment, there are three workflows deployed in cube-clock-configuration:

* change-build.yml
* manual-build.yml
* manual-package-publish.yml

## Manually build any package in the cube-clock-configuration repository (manual-build.yml)

This workflow allows you to build any desired package located in this repository.
The build is based on the yarn command.

To build a package, you need to:

1. Go to the [action tab](https://github.com/PRG-Cube/cube-clock-configuration/actions) in the cube-clock-configuration repository:

![Action tab in the repository](images/action-tab.png)

2. Select the workflow called Manually build and test a package:

![Select the workflow](images/select-workflow.png)

3. Click on `run workflow` and change the workflow settings:

![run the workflow](images/run-workflow.png)

* You can select the branch where the workflow file is hosted. For example if a new feature is added on the workflow but this feature is only available in another branch.

* You can choose on which branch to build the package from.

* You must give the path of the package.json file in the repo. 

The workflow will create a workspace, build the package and output the build logs.
Build files and binaries will not be available or published anywhere.

## Automatic build of packages when a change is pushed (change-build.yml)

This workflow is triggered by pushing changes to a package folder (vsx or npm) on any `pr/**` branch or on `main` branch.

It uses almost the same steps as in the manual build workflow. The input are automatically retrieved from the push event.

If a change modifies multiple packages, the workflow will list the packages to rebuild and build them one by one. 
Let's say you modify a vs code extension and two npm module in one commit, these three packages will be rebuilt when the commit is pushed.

Since the build is not launched in parallel, if a package throws an error during the build, the other builds will be aborted. 

To see the results of this workflow, navigate to the GitHub `Actions` tab and select the workflow called `Rebuild packages on change`

## Manually build any package in the cube-clock-configuration repository (manual-build.yml)

This workflow lets allowed users publish npm packages on the GitHub private registry.

It rebuilds the package before publishing it using the ==npm publish== command

To publish a package, you need to:
  
1. Create a package.json file with the following mandatory sections: 

```bash
"name": "@prg-cube/package-name",
"repository": https://github.com/PRG-Cube/repo-name",
"publishConfig": {      
  "registry": "https://npm.pkg.github.com"    
}
```

2. Go to the [action tab](https://github.com/PRG-Cube/cube-clock-configuration/actions) in the repository:

3. Select the workflow called `Manually publish a package`

4. Click on `run workflow` and change the workflow settings:

* You can select the branch where the workflow file is hosted. For example if a new feature is added on the workflow but this feature is only available in another branch.

* You can choose on which branch to build the package from.

* You must give the path of the package.json file in the repo. 

## Rebuild CubeSTUDIO and test it when a PR targeting main is updated (pr-build-trigger.yml)

This workflow is triggered by pushing changes to any pull request targeting the `main` branch.

It uses the shared [build-studio workflow](https://github.com/PRG-Cube/internal-aci/tree/main/.github/workflows/build-studio.yml). The inputs are automatically retrieved from the push event.

This workflow builds CubeSTUDIO integrating the latest changes of the pull request and launches test scripts to verify that the integration does not break.
It acts as a mandatory check validation steps. If the workflow ends with failures, the merge of the pull request is blocked until the problem is solved (pushing a fix).

To see the detailed results of this workflow, navigate to the GitHub `Actions` tab and select the workflow run. 
You can quickly access the latest run from the pull request page down in the checks section.