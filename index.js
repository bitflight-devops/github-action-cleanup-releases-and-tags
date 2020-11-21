
const { Toolkit } = require('actions-toolkit')

Toolkit.run(async tools => {
    const { context } = tools
    tools.log.info(`Event type is: ${context.event}`)
    const { number, ref } = context.payload

    function basename(path) {
        if (!path) return null;
        return path.split('/').reverse()[0];
    }

    const {
        branch,
        pr_number,
        repository,
        regex,
    } = tools.inputs
    const br = branch || ref
    const pr = pr_number || number
    const searcher = pr || basename(br)

    if (!searcher) {
        tools.exit.failure('This is not a pull_request or delete event, and there was no pr_number, branch, or regex provided!')
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

        tools.exit.failure('context.repo requires a GITHUB_REPOSITORY environment variable like \'owner/repo\'')
    }

    const repos = repoSplit(repository)
    const search_re = regex || `^(.*)?${searcher}(.*)?$`
    const matched_tags = [];
    const matched_releases = [];
    const VERSION_RE = new RegExp(search_re);

    Promise
        .all([
            tools.github.paginate('GET /repos/:owner/:repo/releases', { ...repos }),
            tools.github.paginate('GET /repos/:owner/:repo/tags', { ...repos }),
        ])
        .then(([releases, tags]) => {

            releases.forEach(release => {
                const { id, tag_name } = release;
                const idx = tag_name.search(VERSION_RE);

                if (idx !== -1) {
                    matched_releases.push(id)
                    tools.log.info(`Deleting release id: ${id}`)
                }
            })

            tags.forEach(tag => {
                const idx = tag.name.search(VERSION_RE)

                if (idx !== -1) {
                    matched_tags.push(`tags/${tag.name}`)
                    tools.log.info(`Deleting tag: ${tag.name}`)
                }
            })

            return Promise
                .all(
                    matched_releases.map(release_id => tools.github.repos.deleteRelease({ ...repos, release_id }).catch(err => tools.log.info(`Delete release error: ${err}`))),
                    matched_tags.map(tag_ref => tools.github.git.deleteRef({ ...repos, ref: tag_ref }).catch(err => tools.log.info(`Delete ref error: ${err}`))),
                ).catch(err => tools.exit.failure(err))

        }).catch(err => tools.exit.failure(err))

})