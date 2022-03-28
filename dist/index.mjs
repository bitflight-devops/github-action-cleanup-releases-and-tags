var __defProp = Object.defineProperty;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
import { getInput, setFailed } from "@actions/core";
import { context } from "@actions/github";
import { getOctokitOptions, GitHub } from "@actions/github/lib/utils";
import { throttling } from "@octokit/plugin-throttling";
console.log("Loading MyOctokit");
const MyOctokit = GitHub.plugin(throttling);
const oOptions = {
  throttle: {
    onRateLimit: (retryAfter, options, octokit) => {
      octokit.log.warn(`Request quota exhausted for request ${options.method} ${options.url}`);
      if (options.request.retryCount === 0) {
        octokit.log.info(`Retrying after ${retryAfter} seconds!`);
        return true;
      }
    },
    onAbuseLimit: (retryAfter, options, octokit) => {
      octokit.log.warn(`Abuse detected for request ${options.method} ${options.url}`);
    }
  }
};
const okit = new MyOctokit(getOctokitOptions(getInput("github_token") ?? process.env.GITHUB_TOKEN, oOptions));
okit.log.warn("Is this working");
console.log("Loading action");
function basename(path) {
  if (!path)
    return null;
  return path.split("/").reverse()[0];
}
function repoSplit(inputRepo) {
  if (inputRepo) {
    const [owner, repo] = inputRepo.split("/");
    return { owner, repo };
  }
  if (process.env.GITHUB_REPOSITORY) {
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");
    return { owner, repo };
  }
  if (context.payload.repository) {
    return {
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name
    };
  }
  setFailed(`context.repo requires a GITHUB_REPOSITORY environment variable like 'owner/repo'`);
}
async function run() {
  try {
    console.log(`Event type is: ${context.eventName}`);
    const { number, ref } = context.payload;
    const branch = getInput("branch");
    const pr_number = getInput("pr_number");
    const repository = getInput("repository");
    const regex = getInput("regex");
    const br = branch || ref;
    const pr = pr_number || number;
    const searcher = pr || basename(br);
    if (!searcher) {
      setFailed("This is not a pull_request or delete event, and there was no pr_number, branch, or regex provided!");
    }
    const repos = repoSplit(repository);
    const search_re = regex || `^(.*)?${searcher}(.*)?$`;
    const matched_tags = [];
    const matched_releases = [];
    const VERSION_RE = new RegExp(search_re);
    console.log("Collecting repository releases");
    const releases = await okit.paginate("GET /repos/:owner/:repo/releases", __spreadValues({}, repos));
    console.log(`Scanning ${releases.length} releases matching regex ${VERSION_RE}`);
    for (const release of releases) {
      const { id, tag_name } = release;
      if (tag_name.match(VERSION_RE)) {
        matched_releases.push(id);
        console.log(`Deleting release id: ${id}`);
      }
    }
    console.log(`Found ${matched_releases.length} matching releases`);
    matched_releases.forEach(async (release_id) => {
      try {
        await okit.rest.repos.deleteRelease({ repo: repos.repo, owner: repos.owner, release_id });
      } catch (err) {
        console.log(`Delete release error: ${err}`);
      }
    });
    console.log("Collecting repository tags");
    const tags = await okit.paginate("GET /repos/:owner/:repo/tags", __spreadValues({}, repos));
    console.log(`Scanning ${tags.length} tags matching regex ${VERSION_RE}`);
    for (const tag of tags) {
      if (tag.name.match(VERSION_RE)) {
        matched_tags.push(`tags/${tag.name}`);
        console.log(`Deleting tag: ${tag.name}`);
      }
    }
    console.log(`Found ${matched_tags.length} matching tags`);
    matched_tags.forEach(async (tag_ref) => {
      try {
        await okit.rest.git.deleteRef({ repo: repos.repo, owner: repos.owner, ref: tag_ref });
      } catch (err) {
        console.log(`Delete ref error: ${err}`);
      }
    });
  } catch (error) {
    setFailed(error.message ?? error);
  }
}
console.log("Starting action");
run();
console.log("Ending action");
//# sourceMappingURL=index.mjs.map
