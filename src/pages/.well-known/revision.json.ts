const SHA = /^[0-9a-f]{40}$/;

export const prerender = true;

export function GET() {
  const revision = process.env.GITHUB_SHA;
  if (revision !== undefined && !SHA.test(revision)) {
    throw new Error('GITHUB_SHA must be a full lowercase commit SHA');
  }

  return new Response(`${JSON.stringify({ revision: revision ?? null })}\n`, {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
