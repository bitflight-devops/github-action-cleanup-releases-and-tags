import { getGithubToken } from '@broadshield/github-actions-core-typed-inputs';

const mock_token = 'ghp_1234567890';
describe('getGithubToken', () => {
  it('should return a string', () => {
    process.env['INPUT_GITHUB_TOKEN'] = mock_token;
    process.env['GITHUB_TOKEN'] = mock_token;
    expect(getGithubToken('github_token')).toBe(mock_token);
    expect(getGithubToken(undefined, process.env['GITHUB_TOKEN'] ?? '')).toBe(mock_token);
    expect(getGithubToken()).toBe(mock_token);
  });
});
