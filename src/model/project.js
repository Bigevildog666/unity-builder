import * as core from '@actions/core';
import Unity from './unity';
import Action from './action';

class Project {
  static get relativePath() {
    const projectPath = core.getInput('projectPath') || '.';

    // Input.getFromUser().then(result => result.projectPath);

    return `${projectPath}`;
  }

  static get absolutePath() {
    const { workspace } = Action;

    return `${workspace}/${this.relativePath}`;
  }

  static get libraryFolder() {
    return `${this.relativePath}/${Unity.libraryFolder}`;
  }
}

export default Project;
