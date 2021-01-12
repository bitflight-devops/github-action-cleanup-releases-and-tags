const { Octokit } = require("@octokit/action");
const { throttling } = require("@octokit/plugin-throttling");
const { getInput, setFailed } = require('@actions/core');
const { context } = require('@actions/github');

const MyOctokit = Octokit.plugin(throttling).defaults({
    throttle: {
        onRateLimit: (retryAfter, options, octokit) => {
            octokit.log.warn(
                `Request quota exhausted for request ${options.method} ${options.url}`
            );

            if (options.request.retryCount === 0) {
                // only retries once
                octokit.log.info(`Retrying after ${retryAfter} seconds!`);
                return true;
            }
        },
        onAbuseLimit: (retryAfter, options, octokit) => {
            // does not retry, only logs a warning
            octokit.log.warn(
                `Abuse detected for request ${options.method} ${options.url}`
            );
        },
    },
})

const okit = new MyOctokit()
const { log } = okit

async function run() {

    log.info(`Event type is: ${context.event_name}`)
    const { number, ref } = context.payload

    function basename(path) {
        if (!path) return null;
        return path.split('/').reverse()[0];
    }

    const branch = getInput('branch')
    const pr_number = getInput('pr_number')
    const repository = getInput('repository')
    const regex = getInput('regex')

    const br = branch || ref
    const pr = pr_number || number
    const searcher = pr || basename(br)

    if (!searcher) {
        setFailed('This is not a pull_request or delete event, and there was no pr_number, branch, or regex provided!')
    }

    function repoSplit(inputRepo) {
        if (inputRepo) {
            const [owner, repo] = inputRepo.split('/')
            return { owner, repo }
        }
        if (process.env.GITHUB_REPOSITORY) {
            const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/')
            return { owner, repo }
        }

        if (context.payload.repository) {
            return {
                owner: context.payload.repository.owner.login,
                repo: context.payload.repository.name
            }
        }

        setFailed('context.repo requires a GITHUB_REPOSITORY environment variable like \'owner/repo\'')
    }

    const repos = repoSplit(repository)
    const search_re = regex || `^(.*)?${searcher}(.*)?$`
    const matched_tags = [];
    const matched_releases = [];
    const VERSION_RE = new RegExp(search_re);

    log.info('Collecting repository releases')
    const releases = await okit.paginate('GET /repos/:owner/:repo/releases', { ...repos })

    log.info(`Scanning ${releases.length} releases matching regex ${VERSION_RE}`)
    releases.forEach(release => {
        const { id, tag_name } = release;

        if (tag_name.match(VERSION_RE)) {
            matched_releases.push(id)
            log.info(`Deleting release id: ${id}`)
        }
    })
    log.info(`Found ${matched_releases.length} matching releases`)
    matched_releases.map(release_id => okit.repos.deleteRelease({ ...repos, release_id }).catch(err => log.info(`Delete release error: ${err}`)))

    log.info('Collecting repository tags')
    const tags = await okit.paginate('GET /repos/:owner/:repo/tags', { ...repos })
    log.info(`Scanning ${tags.length} tags matching regex ${VERSION_RE}`)
    tags.forEach(tag => {
        if (tag.name.match(VERSION_RE)) {
            matched_tags.push(`tags/${tag.name}`)
            log.info(`Deleting tag: ${tag.name}`)
        }
    })
    log.info(`Found ${matched_tags.length} matching tags`)
    matched_tags.map(tag_ref => okit.git.deleteRef({ ...repos, ref: tag_ref }).catch(err => log.info(`Delete ref error: ${err}`)))


}
run()