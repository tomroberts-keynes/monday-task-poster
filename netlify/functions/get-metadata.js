const config = require('../../config.json');
const templates = require('../../templates.json');

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

exports.handler = async function () {
  try {
    const data = await mondayQuery(
      `query ($boardId: [ID!]) {
        boards(ids: $boardId) {
          groups { id title }
        }
        users(kind: non_guests) {
          id
          name
        }
      }`,
      { boardId: [String(config.boardId)] }
    );

    const groups = (data.boards[0]?.groups || [])
      .filter((g) => g.title !== 'Miscellaneous Client Tasks' && g.title !== 'New Group')
      .sort((a, b) => a.title.localeCompare(b.title));

    const users = (data.users || []).sort((a, b) => a.name.localeCompare(b.name));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clients: groups,
        assignees: users,
        categories: templates.categories,
        customTemplate: templates.customTemplate,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
