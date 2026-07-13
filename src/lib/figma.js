// Figma OAuth2 helper, following https://developers.figma.com/docs/rest-api/oauth-apps/
const fetch = require("node-fetch");

function buildAuthorizeUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.FIGMA_CLIENT_ID,
    redirect_uri: process.env.FIGMA_REDIRECT_URI,
    scope: process.env.FIGMA_OAUTH_SCOPE || "current_user:read",
    state,
    response_type: "code",
  });
  return "https://www.figma.com/oauth?" + params.toString();
}

// NOTE: Figma's authorization code expires 30 seconds after issuance, so this
// must be called immediately when the callback request arrives.
async function exchangeCodeForToken(code) {
  const basicAuth = Buffer.from(
    `${process.env.FIGMA_CLIENT_ID}:${process.env.FIGMA_CLIENT_SECRET}`
  ).toString("base64");

  const body = new URLSearchParams({
    redirect_uri: process.env.FIGMA_REDIRECT_URI,
    code,
    grant_type: "authorization_code",
  });

  const res = await fetch("https://api.figma.com/v1/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: body.toString(),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error("figma_token_exchange_failed: " + JSON.stringify(json));
  }
  return json; // { user_id_string, access_token, refresh_token, expires_in, token_type }
}

async function getMe(accessToken) {
  const res = await fetch("https://api.figma.com/v1/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error("figma_get_me_failed: " + JSON.stringify(json));
  }
  return json; // { id, email, handle, img_url }
}

module.exports = { buildAuthorizeUrl, exchangeCodeForToken, getMe };
