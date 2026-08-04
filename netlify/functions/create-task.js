const config = require('../../config.json');
const templatesConfig = require('../../templates.json');

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

function findTemplate(categoryKey, templateKey) {
  if (templateKey === 'custom' && (!categoryKey || !templatesConfig.categories[categoryKey])) {
    return templatesConfig.customTemplate;
  }
  const category = templatesConfig.categories[categoryKey];
  if (!category) return null;
  return category.templates.find((t) => t.key === templateKey) || null;
}

function buildUpdateBody(template, fields) {
  const lines = (template.fields || [])
    .map((f) => {
      const value = (fields && fields[f.id]) || '';
      return `<b>${f.label}:</b> ${value || '&mdash;'}`;
    })
    .join('<br>');

  const noteLine = template.assigneeNote ? `<br><br><i>${template.assigneeNote}</i>` : '';
  return lines + noteLine;
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const {
      parentItemId,
      categoryKey,
      templateKey,
      fields,
      assigneeId,
      dueDate,
    } = JSON.parse(event.body);

    if (!parentItemId || !assigneeId || !dueDate || !templateKey) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required field' }) };
    }

    const template = findTemplate(categoryKey, templateKey);

    let updateBody;
    if (templateKey === 'custom') {
      updateBody = (fields && fields.details) ? fields.details.replace(/\n/g, '<br>') : '';
    } else if (template) {
      updateBody = buildUpdateBody(template, fields);
    } else {
      updateBody = '';
    }

    if (!updateBody) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No update content to post' }) };
    }

    await mondayQuery(
      `mutation ($itemId: ID!, $body: String!) {
        create_update(item_id: $itemId, body: $body) {
          id
        }
      }`,
      { itemId: parentItemId, body: updateBody }
    );

    const today = new Date().toISOString().slice(0, 10);
    const columnValues = {
      [config.itemColumnIds.assignee]: { personsAndTeams: [{ id: Number(assigneeId), kind: 'person' }] },
      [config.itemColumnIds.submissionDate]: { date: today },
      [config.itemColumnIds.dueDate]: { date: dueDate },
      [config.itemColumnIds.status]: { label: config.defaultStatus },
    };

    await mondayQuery(
      `mutation ($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
        change_multiple_column_values(
          board_id: $boardId
          item_id: $itemId
          column_values: $columnValues
          create_labels_if_missing: true
        ) {
          id
          name
        }
      }`,
      {
        boardId: config.boardId,
        itemId: parentItemId,
        columnValues: JSON.stringify(columnValues),
      }
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
