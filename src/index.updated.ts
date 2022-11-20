import {Endpoints} from '@broadshield/github-actions-workflow-marie-kondo';

import {
  context,
  getNumberInput,
  getStringInput,
  logger,
  setFailed,
} from '../packages/github-actions-core-typed-inputs/src/github';
import {octokit} from '../packages/github-actions-octokit-hydrated/src/octokit';
import {oNumber, oString} from './types';

logger.info('Loading action');
export function basename(path: string) {
  if (!path) return null;
  return path.split('/').reverse()[0];
}

export function repoSplit(inputRepo?: string): {owner: string; repo: string} | undefined {
  if (inputRepo) {
    const [owner, repo] = inputRepo.split('/');
    return {owner, repo};
  }
  if (process.env.GITHUB_REPOSITORY) {
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
    return {owner, repo};
  }

  if (context.payload.repository) {
    return {
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name,
    };
  }

  setFailed(`context.repo requires a GITHUB_REPOSITORY environment variable like 'owner/repo'`);
}

async function run() {
  try {
    console.log(`Event type is: ${context.eventName}`);
    const pl_number: oNumber =
      context.payload.pull_request?.number ||
      context.payload.issue?.number ||
      context.payload.number;
    const pl_ref: oString = context.payload?.head_ref || context.ref;

    const branch: oString = getStringInput('branch');
    const pr_number = getNumberInput('pr_number');
    const repository = getStringInput('repository', process.env.GITHUB_REPOSITORY);
    const regex = getStringInput('regex');

    const br = branch || pl_ref || 'main';
    const pr: oNumber = pr_number || pl_number;
    const searcher = pr || basename(br);

    if (!searcher) {
      setFailed(
        'This is not a pull_request or delete event, and there was no pr_number, branch, or regex provided!'
      );
    }

    const repos = repoSplit(repository);
    const search_re: string = regex || `^(.*)?${searcher}(.*)?$`;
    const matched_tags: string[] = [];
    const matched_releases: number[] = [];
    const VERSION_RE = new RegExp(search_re);

    console.log('Collecting repository releases');
    type listUserReposReleasesParameters =
      Endpoints['GET /repos/{owner}/{repo}/releases']['parameters'];
    type listUserReposReleases =
      Endpoints['GET /repos/{owner}/{repo}/releases']['response']['data'];

    const releases: listUserReposReleases = await octokit.paginate(
      'GET /repos/:owner/:repo/releases',
      {
        ...repos,
      } as listUserReposReleasesParameters
    );

    console.log(`Scanning ${releases.length} releases matching regex ${VERSION_RE}`);
    for (const release of releases) {
      const {id, tag_name} = release;

      if (VERSION_RE.test(tag_name)) {
        matched_releases.push(id);
        console.log(`Deleting release id: ${id}`);
      }
    }
    console.log(`Found ${matched_releases.length} matching releases`);
    matched_releases.forEach(async (release_id) => {
      try {
        await octokit.rest.repos.deleteRelease({
          repo: repos!.repo,
          owner: repos!.owner,
          release_id,
        });
      } catch (error) {
        console.log(`Delete release error: ${error}`);
      }
    });
    type listUserReposTagsData = Endpoints['GET /repos/{owner}/{repo}/tags']['response']['data'];

    console.log('Collecting repository tags');
    const tags: listUserReposTagsData = await octokit.paginate('GET /repos/:owner/:repo/tags', {
      ...repos,
    });
    console.log(`Scanning ${tags.length} tags matching regex ${VERSION_RE}`);
    for (const tag of tags) {
      if (VERSION_RE.test(tag.name)) {
        matched_tags.push(`tags/${tag.name}`);
        console.log(`Deleting tag: ${tag.name}`);
      }
    }
    console.log(`Found ${matched_tags.length} matching tags`);
    matched_tags.forEach(async (tag_ref) => {
      try {
        await octokit.rest.git.deleteRef({repo: repos!.repo, owner: repos!.owner, ref: tag_ref});
      } catch (error) {
        console.log(`Delete ref error: ${error}`);
      }
    });
  } catch (error: any) {
    setFailed(error.message ?? error);
  }
}
console.log('Starting action');
run();
console.log('Ending action');
