import { isStringObject } from 'node:util/types';

import {
  context,
  getGithubToken,
  getNumberInput,
  getStringInput,
  logger,
  oNumber,
  oString,
  repoSplit,
  setFailed,
} from '@broadshield/github-actions-core-typed-inputs';
import type { PullRequest } from '@broadshield/github-actions-octokit-hydrated';
import { basename, Kondo } from '@broadshield/github-actions-workflow-marie-kondo';

type InputInterface = {
  [key: string]: string | number | boolean | undefined;
};

async function run(): Promise<void> {
  logger.info(`Event type is: ${context.eventName}`);
  const pull_request: PullRequest | undefined = context.payload?.pull_request
    ? (context.payload.pull_request as PullRequest)
    : undefined;
  const context_number: oNumber = pull_request?.number || context.payload.issue?.number || context.payload['number'];
  const pl_ref: oString = pull_request?.head.ref || context.ref;
  const inputs: InputInterface = {};
  inputs['branch'] = getStringInput('branch', pl_ref);
  inputs['pr_number'] = getNumberInput('pr_number', context_number);
  inputs['repository'] = getStringInput('repository', process.env['GITHUB_REPOSITORY']);
  inputs['regex'] = getStringInput('regex');

  const searcher = [inputs['pr_number'], basename(inputs['branch'])].find(Boolean) || undefined;

  if (searcher === undefined && inputs['regex'] === undefined) {
    setFailed('This is not a pull_request or delete event, and there was no pr_number, branch, or regex provided!');
  }
  const token = getGithubToken();
  if (isStringObject(token)) {
    const kondo = new Kondo({ github_token: token, repo: repoSplit(inputs['repository']) });

    const search_re = new RegExp(inputs['regex'] || `^(.*)?${searcher}(.*)?$`);
    const matched_releases: number[] = await kondo.getFilteredReleaseIdsFromRepo(undefined, {
      name: search_re,
    });
    const matched_tags: string[] = await kondo.getFilteredTagRefsFromRepo(undefined, {
      ref: search_re,
    });

    logger.info(`Found ${matched_releases.length} releases and ${matched_tags.length} tags matching ${search_re}`);

    if (matched_releases.length > 0) {
      await kondo.deleteReleasesByIds(matched_releases);
    }
    if (matched_tags.length > 0) {
      await kondo.deleteTagsByRefs(matched_tags);
    }
    logger.info('Done!');
  } else {
    setFailed('No token was provided or discovered GITHUB_TOKEN can be set as an environment variable');
  }
}

await run();
