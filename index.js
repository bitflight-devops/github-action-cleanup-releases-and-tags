const {throttling} = require('@octokit/plugin-throttling')
const {getInput, setFailed} = require('@actions/core')
const {context, log} = require('@actions/github')
const {Octokit} = require('@octokit/action')
console.log('Loading MyOctokit')
const MyOctokit = Octokit.plugin(throttling).defaults({
  auth: process.env.GITHUB_TOKEN,
  throttle: {
    onRateLimit: (retryAfter, options, octokit) => {
      octokit.log.warn(
        `Request quota exhausted for request ${options.method} ${options.url}`
      )

      if (options.request.retryCount === 0) {
        // only retries once
        octokit.log.debug(`Retrying after ${retryAfter} seconds!`)
        return true
      }
    },
    onAbuseLimit: (retryAfter, options, octokit) => {
      // does not retry, only logs a warning
      octokit.log.warn(
        `Abuse detected for request ${options.method} ${options.url}`
      )
    }
  }
})

const okit = new MyOctokit()

console.log('Loading action')
function basename(path) {
  if (!path) return null
  return path.split('/').reverse()[0]
}

function repoSplit(inputRepo) {
  if (inputRepo) {
    const [owner, repo] = inputRepo.split('/')
    return {owner, repo}
  }
  if (process.env.GITHUB_REPOSITORY) {
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/')
    return {owner, repo}
  }

  if (context.payload.repository) {
    return {
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name
    }
  }

  setFailed(
    `context.repo requires a GITHUB_REPOSITORY environment variable like 'owner/repo'`
  )
}

async function run() {
  try {
    log.debug(`Event type is: ${context.event_name}`)
    const {number, ref} = context.payload
    const branch = getInput('branch')
    const pr_number = getInput('pr_number')
    const repository = getInput('repository')
    const regex = getInput('regex')

    const br = branch || ref
    const pr = pr_number || number
    const searcher = pr || basename(br)

    if (!searcher) {
      setFailed(
        'This is not a pull_request or delete event, and there was no pr_number, branch, or regex provided!'
      )
    }

    const repos = repoSplit(repository)
    const search_re = regex || `^(.*)?${searcher}(.*)?$`
    const matched_tags = []
    const matched_releases = []
    const VERSION_RE = new RegExp(search_re)

    log.debug('Collecting repository releases')
    const releases = await okit.paginate('GET /repos/:owner/:repo/releases', {
      ...repos
    })

    log.debug(
      `Scanning ${releases.length} releases matching regex ${VERSION_RE}`
    )
    for (const release of releases) {
      const {id, tag_name} = release

      if (tag_name.match(VERSION_RE)) {
        matched_releases.push(id)
        log.debug(`Deleting release id: ${id}`)
      }
    }
    log.debug(`Found ${matched_releases.length} matching releases`)
    matched_releases.map(release_id => {
      try {
        okit.repos.deleteRelease({...repos, release_id})
      } catch (err) {
        log.debug(`Delete release error: ${err}`)
      }
    })

    log.info('Collecting repository tags')
    const tags = await okit.paginate('GET /repos/:owner/:repo/tags', {...repos})
    log.info(`Scanning ${tags.length} tags matching regex ${VERSION_RE}`)
    for (const tag of tags) {
      if (tag.name.match(VERSION_RE)) {
        matched_tags.push(`tags/${tag.name}`)
        log.info(`Deleting tag: ${tag.name}`)
      }
    }
    log.info(`Found ${matched_tags.length} matching tags`)
    matched_tags.map(tag_ref => {
      try {
        okit.git.deleteRef({...repos, ref: tag_ref})
      } catch (err) {
        log.debug(`Delete ref error: ${err}`)
      }
    })
  } catch (error) {
    setFailed(error.message)
  }
}
console.log('Starting action')
run()
console.log('Ending action')
