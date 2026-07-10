const config = require('../../config.json');

const MONDAY_API_URL = 'https://api.monday.com/v2';

async function mondayQuery(query, variables) {
  const res = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: process.env.MONDAY_API_TOKEN,
      'API-Version': '2024-10',
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    throw new Error(JSON.stringify(json.errors));
  }
  return json.data;
}

exports.handler = async function (event) {
  const groupId = event.queryStringParameters && event.queryStringParameters.groupId;
  if (!groupId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing groupId' }) };
  }

  try {
    const data = await mondayQuery(
      `query ($boardId: ID!, $groupId: [String!]) {
        boards(ids: [$boardId]) {
          groups(ids: $groupId) {
            items_page(limit: 25) {
              items {
                id
                name
              }
            }
          }
        }
      }`,
      { boardId: config.boardId, groupId: [groupId] }
    );

    const items = data.boards[0]?.groups[0]?.items_page?.items || [];
    const filtered = items.filter((i) => !i.name.toLowerCase().includes('key launch details'));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: filtered }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
